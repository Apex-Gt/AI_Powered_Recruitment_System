package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.enums.AiResultType;
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

    public void run(UUID taskId) {
        try {
            while (true) {
                ResumeTask task = store.get(taskId);
                if (task.getStatus() != ResumeTaskStatus.PROCESSING) {
                    return; // finished (duplicate / needs review) or taken away; nothing more to do here
                }
                if (task.getStage() == ResumeTaskStage.DONE) {
                    store.complete(taskId);
                    return;
                }
                store.beginStage(taskId);
                if (!runStage(task)) {
                    return;
                }
            }
        } catch (StageFailure failure) {
            store.recordFailure(taskId, failure);
        } catch (RuntimeException unexpected) {
            // Anything we did not anticipate is treated as transient and counted, never swallowed as success.
            log.error("Unexpected error while processing task {}", taskId, unexpected);
            store.recordFailure(taskId, new StageFailure(StageFailure.Kind.TRANSIENT, "INTERNAL_ERROR",
                    unexpected.getClass().getSimpleName() + ": " + unexpected.getMessage(), unexpected));
        }
    }

    /** @return false when the task reached a terminal state inside the stage and the loop should stop. */
    @SuppressWarnings("unchecked")
    private boolean runStage(ResumeTask task) {
        UUID id = task.getId();
        String path = fileStorage.getFilePath(task.getFileUrl());
        switch (task.getStage()) {
            case EXTRACT -> store.saveExtract(id, ai.extract(path, task.getFileName()));
            case PERSIST -> {
                return store.persistCandidate(id) == TaskStore.PersistOutcome.CREATED;
            }
            case PROFILE -> store.saveProfile(id, ai.profile(path, task.getFileName()));
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
