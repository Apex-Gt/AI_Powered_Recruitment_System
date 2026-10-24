package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.enums.AiResultType;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.service.AIServiceClient;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runs one claimed task from its current stage to the end. Each stage commits before the next starts, so a
 * failure (or a restart) resumes at the failed stage, and work already finished is never repeated.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeTaskProcessor {

    private final TaskStore store;
    private final PipelineAiClient ai;
    private final AiResultStore aiResults;
    private final CandidateService candidateService;
    private final FileStorageService fileStorage;
    private final PipelineProperties properties;
    private final ObjectMapper mapper;
    private final CandidateRepository candidates;
    private final AIServiceClient aiServiceClient;

    /** Threads currently working on a task, so a cancel can interrupt the AI call that thread is blocked on. */
    private final ConcurrentHashMap<UUID, Thread> inFlight = new ConcurrentHashMap<>();

    /**
     * Interrupts the thread working on {@code taskId} here, which abandons its pending AI request. A no-op when the
     * task is not running on this instance (the database state already stops any other instance at its next write).
     */
    public void interrupt(UUID taskId) {
        inFlight.computeIfPresent(taskId, (id, thread) -> {
            thread.interrupt();
            return thread;
        });
    }

    public void run(UUID taskId) {
        inFlight.put(taskId, Thread.currentThread());
        ResumeTaskStage stage = null;
        try {
            while (true) {
                ResumeTask task = store.get(taskId);
                stage = task.getStage();
                if (task.getStatus() != ResumeTaskStatus.PROCESSING) {
                    return; // finished (duplicate / needs review) or taken away; nothing more to do here
                }
                if (task.getStage() == ResumeTaskStage.DONE) {
                    store.complete(taskId);
                    return;
                }
                if (task.getStage() == ResumeTaskStage.INDEX && !task.isRanking()) {
                    // An upload only reads the resume and fills the candidate. Indexing, scoring and the summary
                    // happen when the recruiter ranks the job's candidates.
                    store.complete(taskId);
                    return;
                }
                store.beginStage(taskId);
                if (!runStage(task)) {
                    return;
                }
            }
        } catch (TaskNoLongerRunning cancelled) {
            Thread.interrupted();
            log.info("Task {} was cancelled while it ran; dropping its result", taskId);
            discardOrphanVectors(taskId, stage);
        } catch (StageFailure failure) {
            Thread.interrupted(); // may be the echo of a cancel; recordFailure ignores cancelled tasks
            store.recordFailure(taskId, failure);
        } catch (RuntimeException unexpected) {
            Thread.interrupted();
            // Anything we did not anticipate is treated as transient and counted, never swallowed as success.
            log.error("Unexpected error while processing task {}", taskId, unexpected);
            store.recordFailure(taskId, new StageFailure(StageFailure.Kind.TRANSIENT, "INTERNAL_ERROR",
                    unexpected.getClass().getSimpleName() + ": " + unexpected.getMessage(), unexpected));
        } finally {
            inFlight.remove(taskId);
            Thread.interrupted(); // a cancel's interrupt must not leak into the next task this pool thread runs
        }
    }

    /** An index call that finished after its candidate was removed would leave vectors behind; remove them. */
    private void discardOrphanVectors(UUID taskId, ResumeTaskStage stage) {
        if (stage != ResumeTaskStage.INDEX) {
            return;
        }
        try {
            UUID candidateId = store.get(taskId).getCandidateId();
            if (candidateId != null && !candidates.existsById(candidateId)) {
                aiServiceClient.deleteCandidate(candidateId).subscribe(
                        ok -> log.info("Removed AI vectors for cancelled candidate {}", candidateId),
                        err -> log.warn("Could not remove AI vectors for candidate {}: {}", candidateId, err.getMessage()));
            }
        } catch (RuntimeException e) {
            log.warn("Could not check task {} for leftover vectors: {}", taskId, e.getMessage());
        }
    }

    /** @return false when the task reached a terminal state inside the stage and the loop should stop. */
    @SuppressWarnings("unchecked")
    private boolean runStage(ResumeTask task) {
        UUID id = task.getId();
        String path = fileStorage.getFilePath(task.getFileUrl());
        switch (task.getStage()) {
            case EXTRACT -> store.saveExtract(id, ai.extract(path, task.getFileName()));
            case PROFILE -> store.saveProfile(id, ai.profile(path, task.getFileName()));
            case PERSIST -> {
                return store.persistCandidate(id) == TaskStore.PersistOutcome.CREATED;
            }
            case INDEX -> {
                ai.index(task.getCandidateId(), task.getResumeId(), task.getJobId(), path, task.getFileName());
                store.markIndexed(id);
            }
            case SCORE -> {
                Object job = candidateService.getJobDescription(task.getJobId());
                String key = analysisKey(task, job, false);
                if (key.equals(task.getScoreKey()) && stored(AiResultType.MATCH_SCORE, task).isPresent()) {
                    store.skipScore(id);
                } else {
                    Map<String, Object> result = ai.score(task.getCandidateId(), path, job, profileOf(task));
                    store.saveScore(id, result, key);
                }
            }
            case SUMMARY -> {
                Object job = candidateService.getJobDescription(task.getJobId());
                String key = analysisKey(task, job, true);
                if (key.equals(task.getSummaryKey()) && stored(AiResultType.RAG_SUMMARY, task).isPresent()) {
                    store.skipSummary(id);
                } else {
                    Map<String, Object> score = stored(AiResultType.MATCH_SCORE, task).orElse(null);
                    Map<String, Object> result = ai.summary(task.getCandidateId(), path, job, profileOf(task), score);
                    store.saveSummary(id, result, key);
                }
            }
            case DONE -> {
                return true;
            }
        }
        return true;
    }

    private Optional<Map<String, Object>> stored(AiResultType type, ResumeTask task) {
        return aiResults.find(type, task.getCandidateId(), type == AiResultType.PROFILE ? null : task.getJobId());
    }

    private Map<String, Object> profileOf(ResumeTask task) {
        return aiResults.find(AiResultType.PROFILE, task.getCandidateId(), null)
                .orElseThrow(() -> StageFailure.transientFailure("PROFILE_MISSING", "The candidate profile has not been saved yet"));
    }

    /**
     * Cache key for score and summary: changes when the resume file, the job description, or the
     * analysis/model version changes, and not otherwise. Same key means the stored result is still valid.
     */
    String analysisKey(ResumeTask task, Object job, boolean withModel) {
        String jobJson = mapper.writeValueAsString(job);
        return sha256(task.getSha256() + "|" + jobJson + "|" + properties.getAnalysisVersion() + (withModel ? "|" + properties.getModelTag() : ""));
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
