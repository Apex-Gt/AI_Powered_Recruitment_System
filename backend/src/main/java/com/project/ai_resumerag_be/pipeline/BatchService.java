package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.enums.AiResultType;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.pipeline.BatchViews.BatchView;
import com.project.ai_resumerag_be.pipeline.BatchViews.TaskView;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.FileStorageService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Bulk upload and monitoring. Uploading only validates, stores and enqueues: it never calls the AI service, so
 * the request returns as soon as the files are on disk, whatever the batch size.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchService {

    private final CandidateService candidateService;
    private final ResumeBatchRepository batches;
    private final ResumeTaskRepository tasks;
    private final CandidateRepository candidates;
    private final TaskStore store;
    private final FileStorageService fileStorage;
    private final AiResultStore aiResults;
    private final PipelineProperties properties;

    // ------------------------------------------------------------------- upload

    public ResumeBatch createBatch(UUID jobId, List<MultipartFile> files) {
        Job job = candidateService.requireOwnedJob(jobId); // company + job ownership; 404 otherwise
        PipelineProperties.Upload limits = properties.getUpload();

        List<MultipartFile> received = files == null ? List.of() : files.stream().filter(Objects::nonNull).toList(); // empty files are kept: each gets its own EMPTY_FILE row
        if (received.isEmpty()) {
            throw new BadRequestException("No resume files were uploaded");
        }
        if (received.size() > limits.getMaxFiles()) {
            throw new BadRequestException("A batch can hold at most " + limits.getMaxFiles() + " resumes; this one has " + received.size());
        }
        long total = received.stream().mapToLong(MultipartFile::getSize).sum();
        if (total > limits.getMaxBatchSize().toBytes()) {
            throw new BadRequestException("The batch is larger than " + limits.getMaxBatchSize().toMegabytes() + " MB in total");
        }

        ResumeBatch batch = batches.save(ResumeBatch.builder()
                .jobId(jobId)
                .companyId(job.getCompany().getId())
                .createdBy(currentUserId())
                .totalFiles(received.size())
                .status(BatchStatus.UPLOADED)
                .build());

        Set<String> seenInRequest = new HashSet<>();
        for (MultipartFile file : received) {
            try {
                accept(batch, jobId, file, seenInRequest, limits);
            } catch (IOException | RuntimeException e) {
                // One unreadable upload must not sink the batch: record it against its own row and carry on.
                log.warn("Could not accept an upload in batch {}: {}", batch.getId(), e.getMessage()); // file names can hold personal data
                store.insertTask(terminal(batch, jobId, UploadValidator.safeName(file.getOriginalFilename()), file.getSize(), null,
                        ResumeTaskStatus.FAILED, "UPLOAD_ERROR", "The file could not be read from the upload"));
            }
        }
        store.refreshBatch(batch.getId());
        log.info("Batch {} accepted with {} file(s) for job {}", batch.getId(), received.size(), jobId);
        return batches.findById(batch.getId()).orElse(batch);
    }

    private void accept(ResumeBatch batch, UUID jobId, MultipartFile file, Set<String> seenInRequest, PipelineProperties.Upload limits) throws IOException {
        String name = UploadValidator.safeName(file.getOriginalFilename());

        UploadValidator.Verdict verdict;
        try (InputStream in = file.getInputStream()) {
            verdict = UploadValidator.check(name, file.getSize(), in, limits.getAllowedExtensions(), limits.getMaxFileSize().toBytes());
        }
        if (!verdict.ok()) {
            store.insertTask(terminal(batch, jobId, name, file.getSize(), null, ResumeTaskStatus.FAILED, verdict.code(), verdict.message()));
            return;
        }

        String sha = sha256(file);
        String key = jobId + ":" + sha;
        if (!seenInRequest.add(key) || tasks.existsByDedupeKey(key)) {
            store.insertTask(terminal(batch, jobId, name, file.getSize(), sha, ResumeTaskStatus.DUPLICATE, "DUPLICATE_FILE",
                    "An identical file is already in this job"));
            return;
        }

        String stored = fileStorage.storeFile(file, "resumes/" + jobId);
        ResumeTask task = ResumeTask.builder()
                .batchId(batch.getId())
                .jobId(jobId)
                .companyId(batch.getCompanyId())
                .fileName(name)
                .fileUrl(stored)
                .sizeBytes(file.getSize())
                .sha256(sha)
                .dedupeKey(key)
                .status(ResumeTaskStatus.QUEUED)
                .stage(ResumeTaskStage.EXTRACT)
                .nextAttemptAt(LocalDateTime.now())
                .build();
        if (!store.insertTask(task)) {
            // Lost a race with a concurrent upload of the same file: keep one copy, record this as a duplicate.
            deleteQuietly(stored);
            store.insertTask(terminal(batch, jobId, name, file.getSize(), sha, ResumeTaskStatus.DUPLICATE, "DUPLICATE_FILE",
                    "An identical file is already in this job"));
        }
    }

    private ResumeTask terminal(ResumeBatch batch, UUID jobId, String name, long size, String sha, ResumeTaskStatus status, String code, String message) {
        LocalDateTime now = LocalDateTime.now();
        return ResumeTask.builder()
                .batchId(batch.getId())
                .jobId(jobId)
                .companyId(batch.getCompanyId())
                .fileName(name)
                .sizeBytes(size)
                .sha256(sha)
                .status(status)
                .stage(ResumeTaskStage.EXTRACT)
                .nextAttemptAt(now)
                .errorCode(code)
                .errorMessage(message)
                .finishedAt(now)
                .build();
    }

    // ----------------------------------------------------------------- progress

    public BatchView progress(UUID batchId) {
        ResumeBatch batch = requireAccessible(batchId);
        Map<ResumeTaskStatus, Long> counts = store.counts(batchId);
        List<ResumeTask> all = tasks.findByBatchId(batchId);

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (ResumeTaskStatus s : ResumeTaskStatus.values()) {
            byStatus.put(s.name(), counts.getOrDefault(s, 0L));
        }

        LocalDateTime start = batch.getCreatedAt();
        LocalDateTime end = batch.getCompletedAt() != null ? batch.getCompletedAt() : LocalDateTime.now();
        long finished = counts.entrySet().stream().filter(e -> !e.getKey().isActive()).mapToLong(Map.Entry::getValue).sum();
        long remaining = Math.max(0, batch.getTotalFiles() - finished);
        List<Double> latencies = BatchProgress.latenciesSeconds(all);
        Double rate = BatchProgress.perMinute(finished, start, end);
        Long eta = rate != null && remaining > 0 && batch.getCompletedAt() == null ? Math.round(remaining / rate * 60) : null;

        return new BatchView(batch.getId(), batch.getJobId(), batch.getStatus(), batch.getTotalFiles(),
                BatchProgress.percent(counts, batch.getTotalFiles()), byStatus, batch.getCreatedAt(), batch.getCompletedAt(),
                Duration.between(start, end).toMillis() / 1000.0, rate,
                BatchProgress.percentile(latencies, 50), BatchProgress.percentile(latencies, 95), eta);
    }

    public Page<TaskView> listTasks(UUID batchId, ResumeTaskStatus status, int page, int size) {
        requireAccessible(batchId);
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200), Sort.by("createdAt").ascending());
        Page<ResumeTask> result = status == null ? tasks.findByBatchId(batchId, pageable) : tasks.findByBatchIdAndStatus(batchId, status, pageable);
        return result.map(TaskView::of);
    }

    public List<BatchView> recentForJob(UUID jobId) {
        candidateService.requireOwnedJob(jobId);
        return batches.findTop20ByJobIdOrderByCreatedAtDesc(jobId).stream().map(b -> progress(b.getId())).toList();
    }

    /** Candidates this batch produced, best match first, with the score breakdown and summary beside each name. */
    public List<Map<String, Object>> results(UUID batchId) {
        ResumeBatch batch = requireAccessible(batchId);
        List<ResumeTask> done = tasks.findByBatchIdAndStatusIn(batchId, List.of(ResumeTaskStatus.COMPLETED, ResumeTaskStatus.NEEDS_REVIEW)).stream()
                .filter(t -> t.getCandidateId() != null).toList();
        Map<UUID, Candidate> byId = candidates.findAllById(done.stream().map(ResumeTask::getCandidateId).toList()).stream()
                .collect(Collectors.toMap(Candidate::getId, c -> c));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ResumeTask task : done) {
            Candidate candidate = byId.get(task.getCandidateId());
            if (candidate == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("taskId", task.getId());
            row.put("candidateId", candidate.getId());
            row.put("candidateName", candidate.getCandidateName());
            row.put("candidateEmail", candidate.getCandidateEmail());
            row.put("status", task.getStatus());
            row.put("warnings", TaskView.of(task).warnings());
            aiResults.find(AiResultType.PROFILE, candidate.getId(), null).ifPresent(profile -> {
                row.put("extractedName", profile.get("name"));
                row.put("extractedSkills", skillNames(profile.get("skills")));
                row.put("statedExperienceYears", profile.get("total_experience_years"));
            });
            aiResults.find(AiResultType.MATCH_SCORE, candidate.getId(), batch.getJobId()).ifPresent(score -> {
                row.put("overallScore", score.get("overallScore"));
                row.put("skillMatchScore", score.get("skillMatchScore"));
                row.put("experienceMatchScore", score.get("experienceMatchScore"));
                row.put("educationMatchScore", score.get("educationMatchScore"));
                row.put("semanticMatchScore", score.get("semanticMatchScore"));
                row.put("meetsMandatory", score.getOrDefault("meetsMandatory", true));
                row.put("mandatoryMissing", score.getOrDefault("mandatoryMissing", List.of()));
                row.put("matchedSkills", score.getOrDefault("matchedSkills", List.of()));
                row.put("missingSkills", score.getOrDefault("missingSkills", List.of()));
                row.put("skillEvidence", score.getOrDefault("skillEvidence", Map.of()));
                row.put("totalExperienceYears", score.get("totalExperienceYears"));
                row.put("relevantExperienceYears", score.get("relevantExperienceYears"));
                row.put("scoreWarnings", score.getOrDefault("warnings", List.of()));
            });
            aiResults.find(AiResultType.RAG_SUMMARY, candidate.getId(), batch.getJobId()).ifPresent(summary -> {
                row.put("summary", summary.get("summaryText"));
                row.put("strengths", summary.getOrDefault("strengths", List.of()));
            });
            rows.add(row);
        }
        rows.sort(Comparator.comparingDouble((Map<String, Object> r) -> r.get("overallScore") instanceof Number n ? n.doubleValue() : -1).reversed());
        return rows;
    }

    private static List<String> skillNames(Object skills) {
        if (!(skills instanceof List<?> list)) {
            return List.of();
        }
        List<String> names = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> m && m.get("name") instanceof String name) {
                names.add(name);
            }
        }
        return names;
    }

    // -------------------------------------------------------------------- retry

    public int retryFailed(UUID batchId) {
        requireAccessible(batchId);
        return store.retryFailed(batchId);
    }

    public boolean retryTask(UUID batchId, UUID taskId) {
        requireAccessible(batchId);
        ResumeTask task = tasks.findById(taskId).filter(t -> t.getBatchId().equals(batchId))
                .orElseThrow(() -> new ResourceNotFoundException("Resume task not found: " + taskId));
        return store.retryOne(task.getId());
    }

    // ------------------------------------------------------------------- access

    /** Loads a batch only if the caller may see its job (same company; recruiters only their own jobs). */
    ResumeBatch requireAccessible(UUID batchId) {
        ResumeBatch batch = batches.findById(batchId).orElseThrow(() -> new ResourceNotFoundException("Batch not found: " + batchId));
        Job job = candidateService.requireOwnedJob(batch.getJobId());
        if (!job.getCompany().getId().equals(batch.getCompanyId())) {
            throw new ResourceNotFoundException("Batch not found: " + batchId);
        }
        return batch;
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof CustomUserDetails details ? details.getUser().getId() : null;
    }

    private void deleteQuietly(String fileUrl) {
        try {
            fileStorage.deleteFile(fileUrl);
        } catch (IOException e) {
            log.warn("Could not delete {}: {}", fileUrl, e.getMessage());
        }
    }

    private static String sha256(MultipartFile file) throws IOException {
        try (InputStream raw = file.getInputStream()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (DigestInputStream in = new DigestInputStream(raw, digest)) {
                in.transferTo(java.io.OutputStream.nullOutputStream());
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
