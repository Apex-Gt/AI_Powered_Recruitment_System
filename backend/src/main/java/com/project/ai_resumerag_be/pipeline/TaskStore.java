package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.Resume;
import com.project.ai_resumerag_be.enumerators.AiResultType;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.JobRepository;
import com.project.ai_resumerag_be.repository.ResumeRepository;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.FileStorageService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Every state change of a task, each in its own short transaction. The processor calls these between AI calls so
 * a database transaction is never held open across a slow model request, and so each finished stage is durable
 * the moment it completes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskStore {

    private final ResumeTaskRepository tasks;
    private final ResumeBatchRepository batches;
    private final CandidateRepository candidates;
    private final ResumeRepository resumes;
    private final JobRepository jobs;
    private final AiResultStore aiResults;
    private final FileStorageService fileStorage;
    private final PipelineProperties properties;
    private final ObjectMapper mapper;

    @PersistenceContext
    private EntityManager em;

    private RetryPolicy retryPolicy() {
        return new RetryPolicy(properties.getRetry());
    }

    // ------------------------------------------------------------------ claiming

    /** Atomically reserves up to {@code limit} due tasks for {@code worker}. Concurrent callers never get the same row. */
    @Transactional
    public List<UUID> claim(String worker, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        LocalDateTime now = LocalDateTime.now();
        List<UUID> ids = tasks.lockDueTaskIds(now, limit);
        if (ids.isEmpty()) {
            return ids;
        }
        Set<UUID> touchedBatches = new HashSet<>();
        for (ResumeTask task : tasks.findAllById(ids)) {
            task.setStatus(ResumeTaskStatus.PROCESSING);
            task.setLockedBy(worker);
            task.setLockedUntil(now.plus(properties.getWorker().getLease()));
            if (task.getStartedAt() == null) {
                task.setStartedAt(now);
            }
            touchedBatches.add(task.getBatchId());
        }
        touchedBatches.forEach(this::refreshBatch);
        return ids;
    }

    /**
     * Puts tasks whose worker disappeared (crash, kill -9, redeploy) back in the queue. A task that has used all its
     * attempts is failed instead, so a resume that crashes the worker every time cannot loop forever.
     */
    @Transactional
    public int recoverExpiredLeases() {
        List<ResumeTask> expired = tasks.findExpiredLeases(LocalDateTime.now());
        for (ResumeTask task : expired) {
            log.warn("Recovering task {} (stage {}) whose worker {} stopped renewing its lease", task.getId(), task.getStage(), task.getLockedBy());
            if (retryPolicy().canRetry(task.getStageAttempts())) {
                task.setStatus(ResumeTaskStatus.QUEUED);
                task.setNextAttemptAt(LocalDateTime.now());
                task.setErrorCode("WORKER_LOST");
                task.setErrorMessage("The worker processing this resume stopped; it was queued again");
                release(task);
            } else {
                fail(task, "WORKER_LOST", "The worker stopped repeatedly while processing this resume");
            }
            refreshBatch(task.getBatchId());
        }
        return expired.size();
    }

    @Transactional(readOnly = true)
    public ResumeTask get(UUID taskId) {
        return tasks.findById(taskId).orElseThrow(() -> new NoSuchElementException("Task not found: " + taskId));
    }

    @Transactional
    public void renewLease(UUID taskId) {
        tasks.findById(taskId).ifPresent(t -> t.setLockedUntil(LocalDateTime.now().plus(properties.getWorker().getLease())));
    }

    /** Counts the attempt before the stage runs, so a crash mid-stage still consumes one. */
    @Transactional
    public void beginStage(UUID taskId) {
        ResumeTask task = get(taskId);
        task.setStageAttempts(task.getStageAttempts() + 1);
        task.setTotalAttempts(task.getTotalAttempts() + 1);
        task.setLockedUntil(LocalDateTime.now().plus(properties.getWorker().getLease()));
    }

    // -------------------------------------------------------------------- stages

    @Transactional
    public void saveExtract(UUID taskId, Map<String, Object> result) {
        ResumeTask task = get(taskId);
        task.setExtractJson(mapper.writeValueAsString(result));
        addWarnings(task, result.get("warnings"));
        if (Boolean.TRUE.equals(result.get("needsReview"))) {
            task.setNeedsReview(true);
        }
        advance(task);
    }

    /** Result of trying to turn an extracted resume into a Candidate. */
    public enum PersistOutcome { CREATED, DUPLICATE, NEEDS_REVIEW }

    /**
     * Creates the Resume and Candidate rows. Idempotent: a task that already has a candidate (a retry after a
     * crash between commit and the next stage) just moves on. A per-applicant advisory lock stops two workers
     * from both creating the same applicant for the same job.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public PersistOutcome persistCandidate(UUID taskId) {
        ResumeTask task = get(taskId);
        if (task.getCandidateId() != null) {
            advance(task);
            return PersistOutcome.CREATED;
        }

        Map<String, Object> extract = readMap(task.getExtractJson());
        Map<String, Object> contact = extract.get("contact") instanceof Map<?, ?> c ? (Map<String, Object>) c : Map.of();
        String email = str(contact.get("email"));
        if (email == null) {
            needsReview(task, "NO_EMAIL", "No email address was found in this resume, so a candidate cannot be created. Check the file or add the candidate by hand.");
            return PersistOutcome.NEEDS_REVIEW;
        }
        email = email.toLowerCase(Locale.ROOT);

        // Wrapped in a count so the query returns a normal integer: pg_advisory_xact_lock itself returns void,
        // which JPA cannot map to a result column.
        em.createNativeQuery("select count(*) from (select pg_advisory_xact_lock(hashtext(:k))) as held")
                .setParameter("k", task.getJobId() + ":" + email)
                .getSingleResult();

        List<Candidate> existing = candidates.findByJobIdAndCandidateEmail(task.getJobId(), email);
        if (existing.isEmpty()) {
            existing = candidates.findByJobIdAndCandidateEmail(task.getJobId(), str(contact.get("email")));
        }
        if (!existing.isEmpty()) {
            task.setCandidateId(existing.get(0).getId());
            markDuplicate(task, "DUPLICATE_APPLICANT", email + " has already applied for this job");
            return PersistOutcome.DUPLICATE;
        }

        Job job = jobs.findById(task.getJobId()).orElseThrow(() -> new NoSuchElementException("Job not found: " + task.getJobId()));
        Resume resume = resumes.save(Resume.builder()
                .fileName(task.getFileName())
                .fileUrl(task.getFileUrl())
                .extractedText(str(extract.get("text")))
                .sha256(task.getSha256())
                .build());
        String name = str(contact.get("name"));
        Candidate candidate = candidates.save(Candidate.builder()
                .candidateName(name != null ? name : "Unknown candidate")
                .candidateEmail(email)
                .phoneNumber(str(contact.get("phone")))
                .job(job)
                .resume(resume)
                .build());
        task.setCandidateId(candidate.getId());
        task.setResumeId(resume.getId());
        advance(task);
        return PersistOutcome.CREATED;
    }

    @Transactional
    public void saveProfile(UUID taskId, Map<String, Object> result) {
        ResumeTask task = get(taskId);
        @SuppressWarnings("unchecked")
        Map<String, Object> profile = (Map<String, Object>) result.get("profile");
        aiResults.save(AiResultType.PROFILE, task.getCandidateId(), null, profile);
        addWarnings(task, result.get("warnings"));

        // The first guess at the name came from the resume header; the validated profile is better when it has one.
        candidates.findById(task.getCandidateId()).ifPresent(candidate -> {
            String name = str(profile.get("name"));
            if (name != null && !"Unknown".equalsIgnoreCase(name)) {
                candidate.setCandidateName(name);
            }
            if (candidate.getPhoneNumber() == null && str(profile.get("phone")) != null) {
                candidate.setPhoneNumber(str(profile.get("phone")));
            }
            if (candidate.getLocation() == null && str(profile.get("location")) != null) {
                candidate.setLocation(str(profile.get("location")));
            }
        });
        advance(task);
    }

    @Transactional
    public void markIndexed(UUID taskId) {
        advance(get(taskId));
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public void saveScore(UUID taskId, Map<String, Object> result, String key) {
        ResumeTask task = get(taskId);
        Map<String, Object> score = (Map<String, Object>) result.get("matchScore");
        aiResults.save(AiResultType.MATCH_SCORE, task.getCandidateId(), task.getJobId(), score);
        task.setScoreKey(key);
        advance(task);
    }

    /** Score unchanged for this resume and job: nothing to compute. */
    @Transactional
    public void skipScore(UUID taskId) {
        advance(get(taskId));
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public void saveSummary(UUID taskId, Map<String, Object> result, String key) {
        ResumeTask task = get(taskId);
        Map<String, Object> summary = (Map<String, Object>) result.get("ragSummary");
        aiResults.save(AiResultType.RAG_SUMMARY, task.getCandidateId(), task.getJobId(), summary);
        task.setSummaryKey(key);
        advance(task);
    }

    @Transactional
    public void skipSummary(UUID taskId) {
        advance(get(taskId));
    }

    @Transactional
    public void complete(UUID taskId) {
        ResumeTask task = get(taskId);
        task.setStatus(task.isNeedsReview() ? ResumeTaskStatus.NEEDS_REVIEW : ResumeTaskStatus.COMPLETED);
        task.setStage(ResumeTaskStage.DONE);
        task.setErrorCode(null);
        task.setErrorMessage(null);
        task.setFinishedAt(LocalDateTime.now());
        release(task);
        refreshBatch(task.getBatchId());
    }

    // ------------------------------------------------------------------ failures

    /** Applies the retry/fail/review decision for a failed stage. */
    @Transactional
    public void recordFailure(UUID taskId, StageFailure failure) {
        ResumeTask task = get(taskId);
        switch (failure.kind()) {
            case TRANSIENT -> {
                task.setErrorCode(failure.code());
                task.setErrorMessage(truncate(failure.getMessage()));
                if (retryPolicy().canRetry(task.getStageAttempts())) {
                    Duration delay = retryPolicy().delayAfter(task.getStageAttempts());
                    task.setStatus(ResumeTaskStatus.QUEUED);
                    task.setNextAttemptAt(LocalDateTime.now().plus(delay));
                    log.warn("Task {} stage {} failed ({}), attempt {}/{}; retrying in {}s", taskId, task.getStage(), failure.code(),
                            task.getStageAttempts(), retryPolicy().maxAttempts(), delay.toSeconds());
                    release(task);
                } else {
                    fail(task, failure.code(), "Gave up after " + task.getStageAttempts() + " attempts: " + failure.getMessage());
                }
            }
            case PERMANENT -> fail(task, failure.code(), failure.getMessage());
            case NEEDS_REVIEW -> needsReview(task, failure.code(), failure.getMessage());
        }
        refreshBatch(task.getBatchId());
    }

    // --------------------------------------------------------------- user actions

    /** Puts FAILED tasks of a batch back in the queue at the stage they stopped. Returns how many were requeued. */
    @Transactional
    public int retryFailed(UUID batchId) {
        int requeued = 0;
        for (ResumeTask task : tasks.findByBatchIdAndStatusIn(batchId, List.of(ResumeTaskStatus.FAILED))) {
            if (requeue(task)) {
                requeued++;
            }
        }
        refreshBatch(batchId);
        return requeued;
    }

    @Transactional
    public boolean retryOne(UUID taskId) {
        ResumeTask task = get(taskId);
        if (task.getStatus() != ResumeTaskStatus.FAILED) {
            return false;
        }
        boolean ok = requeue(task);
        refreshBatch(task.getBatchId());
        return ok;
    }

    private boolean requeue(ResumeTask task) {
        if (task.getFileUrl() == null) {
            return false; // rejected before storage (unsupported type, too large): there is nothing to retry
        }
        String key = task.getJobId() + ":" + task.getSha256();
        if (task.getSha256() != null && tasks.existsByDedupeKey(key)) {
            return false; // the same file was uploaded again and is live; this one stays failed
        }
        task.setDedupeKey(task.getSha256() == null ? null : key);
        task.setStatus(ResumeTaskStatus.QUEUED);
        task.setStageAttempts(0);
        task.setNextAttemptAt(LocalDateTime.now());
        task.setFinishedAt(null);
        task.setErrorCode(null);
        task.setErrorMessage(null);
        return true;
    }

    /** Inserts a task in its own transaction so one duplicate or constraint clash cannot roll back its siblings. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean insertTask(ResumeTask task) {
        try {
            tasks.saveAndFlush(task);
            return true;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }

    // ----------------------------------------------------------------- retention

    /**
     * Deletes personal data the product no longer needs. Uploads that never became a candidate lose their stored file
     * and extracted text; finished tasks lose their extracted-text copy. Returns how many tasks were changed.
     */
    @Transactional
    public int purgeExpired(int unusableDays, int extractedTextDays) {
        int changed = 0;
        LocalDateTime now = LocalDateTime.now();
        if (unusableDays > 0) {
            List<ResumeTask> stale = tasks.findTop500ByStatusInAndFinishedAtBeforeAndCandidateIdIsNull(
                    List.of(ResumeTaskStatus.FAILED, ResumeTaskStatus.NEEDS_REVIEW, ResumeTaskStatus.DUPLICATE), now.minusDays(unusableDays));
            for (ResumeTask task : stale) {
                if (task.getFileUrl() == null && task.getExtractJson() == null) {
                    continue;
                }
                deleteStoredFile(task.getFileUrl());
                task.setFileUrl(null);
                task.setExtractJson(null);
                changed++;
            }
        }
        if (extractedTextDays > 0) {
            for (ResumeTask task : tasks.findTop500ByFinishedAtBeforeAndExtractJsonIsNotNull(now.minusDays(extractedTextDays))) {
                task.setExtractJson(null);
                changed++;
            }
        }
        return changed;
    }

    // ------------------------------------------------------------------- batches

    @Transactional
    public void refreshBatch(UUID batchId) {
        batches.findById(batchId).ifPresent(batch -> {
            Map<ResumeTaskStatus, Long> counts = counts(batchId);
            BatchStatus status = BatchProgress.statusFor(counts, batch.getTotalFiles());
            batch.setStatus(status);
            boolean terminal = status == BatchStatus.COMPLETED || status == BatchStatus.PARTIAL || status == BatchStatus.FAILED;
            if (terminal && batch.getCompletedAt() == null) {
                batch.setCompletedAt(LocalDateTime.now());
            } else if (!terminal) {
                batch.setCompletedAt(null);
            }
        });
    }

    @Transactional(readOnly = true)
    public Map<ResumeTaskStatus, Long> counts(UUID batchId) {
        Map<ResumeTaskStatus, Long> counts = new EnumMap<>(ResumeTaskStatus.class);
        for (Object[] row : tasks.countByStatus(batchId)) {
            counts.put((ResumeTaskStatus) row[0], (Long) row[1]);
        }
        return counts;
    }

    // ------------------------------------------------------------------- helpers

    private void advance(ResumeTask task) {
        task.setStage(task.getStage().next());
        task.setStageAttempts(0);
        task.setErrorCode(null);
        task.setErrorMessage(null);
    }

    private void release(ResumeTask task) {
        task.setLockedBy(null);
        task.setLockedUntil(null);
    }

    private void fail(ResumeTask task, String code, String message) {
        task.setStatus(ResumeTaskStatus.FAILED);
        task.setErrorCode(code);
        task.setErrorMessage(truncate(message));
        task.setDedupeKey(null); // a failed file must not block uploading a fixed copy
        task.setFinishedAt(LocalDateTime.now());
        release(task);
    }

    private void needsReview(ResumeTask task, String code, String message) {
        task.setStatus(ResumeTaskStatus.NEEDS_REVIEW);
        task.setNeedsReview(true);
        task.setErrorCode(code);
        task.setErrorMessage(truncate(message));
        task.setDedupeKey(null);
        task.setFinishedAt(LocalDateTime.now());
        release(task);
        refreshBatch(task.getBatchId());
    }

    private void markDuplicate(ResumeTask task, String code, String message) {
        task.setStatus(ResumeTaskStatus.DUPLICATE);
        task.setErrorCode(code);
        task.setErrorMessage(message);
        task.setDedupeKey(null);
        task.setFinishedAt(LocalDateTime.now());
        release(task);
        deleteStoredFile(task.getFileUrl());
        refreshBatch(task.getBatchId());
    }

    private void deleteStoredFile(String fileUrl) {
        if (fileUrl == null) {
            return;
        }
        try {
            fileStorage.deleteFile(fileUrl);
        } catch (IOException e) {
            log.warn("Could not delete duplicate resume file {}: {}", fileUrl, e.getMessage());
        }
    }

    private void addWarnings(ResumeTask task, Object raw) {
        if (!(raw instanceof Collection<?> items) || items.isEmpty()) {
            return;
        }
        Set<String> merged = new LinkedHashSet<>();
        if (task.getWarnings() != null && !task.getWarnings().isBlank()) {
            merged.addAll(Arrays.asList(task.getWarnings().split("\n")));
        }
        items.forEach(item -> merged.add(String.valueOf(item)));
        task.setWarnings(String.join("\n", merged));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readMap(String json) {
        return json == null ? Map.of() : mapper.readValue(json, Map.class);
    }

    private static String str(Object value) {
        return value instanceof String s && !s.isBlank() ? s.trim() : null;
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= 1900 ? message : message.substring(0, 1900) + "...";
    }
}
