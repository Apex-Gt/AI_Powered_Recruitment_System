package com.project.ai_resumerag_be.pipeline;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One resume moving through the pipeline. This row is also the queue entry: workers claim QUEUED rows whose
 * {@code nextAttemptAt} has passed using {@code FOR UPDATE SKIP LOCKED}, and hold a lease in {@code lockedUntil}.
 */
@Entity
@Table(name = "resume_tasks", indexes = {
        @Index(name = "idx_resume_tasks_claim", columnList = "status, next_attempt_at"),
        @Index(name = "idx_resume_tasks_batch", columnList = "batch_id, status"),
        @Index(name = "idx_resume_tasks_candidate", columnList = "candidate_id")
}, uniqueConstraints = {
        // Exact-duplicate guard. Only live tasks hold a key: it is cleared when a task fails for good, and
        // duplicates never get one.
        @UniqueConstraint(name = "uk_resume_tasks_dedupe", columnNames = "dedupe_key")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumeTask {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false)
    private String fileName;

    /** Storage-relative path (null when the file was rejected before it was stored). */
    private String fileUrl;

    private long sizeBytes;

    @Column(length = 64)
    private String sha256;

    @Column(name = "dedupe_key", length = 120)
    private String dedupeKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResumeTaskStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResumeTaskStage stage;

    /** Attempts at the current stage; reset when a stage succeeds. Drives the backoff and the retry cap. */
    @Column(nullable = false)
    private int stageAttempts;

    @Column(nullable = false)
    private int totalAttempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    private String lockedBy;

    private LocalDateTime lockedUntil;

    @Column(length = 60)
    private String errorCode;

    @Column(length = 2000)
    private String errorMessage;

    /** Output of the EXTRACT stage (text + contact fields), kept as evidence and reused by PERSIST. */
    @Column(columnDefinition = "TEXT")
    private String extractJson;

    /** Newline-separated notes for the recruiter (low text, ungrounded skills dropped, ...). */
    @Column(columnDefinition = "TEXT")
    private String warnings;

    @Column(nullable = false)
    private boolean needsReview;

    private UUID candidateId;

    private UUID resumeId;

    @Column(length = 64)
    private String scoreKey;

    @Column(length = 64)
    private String summaryKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (nextAttemptAt == null) {
            nextAttemptAt = createdAt;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
