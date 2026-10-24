package com.project.ai_resumerag_be.pipeline;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Response shapes of the batch API. */
public final class BatchViews {

    private BatchViews() {
    }

    public record BatchView(
            UUID id,
            UUID jobId,
            BatchStatus status,
            int totalFiles,
            int percentComplete,
            Map<String, Long> counts,
            LocalDateTime createdAt,
            LocalDateTime completedAt,
            Double elapsedSeconds,
            Double resumesPerMinute,
            Double medianSecondsPerResume,
            Double p95SecondsPerResume,
            Long estimatedSecondsRemaining,
            /** Resumes currently being ranked (as opposed to read); when above zero, cancelling stops the ranking only. */
            long ranking,
            /** Latest ranking run: resumes in it, ranked so far, and failed. All zero when the batch was never ranked. */
            long rankingTotal,
            long rankingDone,
            long rankingFailed) {
    }

    public record TaskView(
            UUID id,
            String fileName,
            ResumeTaskStatus status,
            ResumeTaskStage stage,
            int attempts,
            String errorCode,
            String errorMessage,
            boolean needsReview,
            List<String> warnings,
            UUID candidateId,
            LocalDateTime createdAt,
            LocalDateTime finishedAt,
            /** Set (to the same instant for every resume) when the task was queued for ranking; null if it never was. */
            LocalDateTime rankRunAt,
            /** Plain-language account of what is happening to this resume, or why it stopped and what to do. */
            String note,
            /** Seconds spent on the resume so far; only while it is being processed. */
            Long elapsedSeconds) {

        static TaskView of(ResumeTask t, int maxAttempts) {
            List<String> warnings = t.getWarnings() == null || t.getWarnings().isBlank() ? List.of() : List.of(t.getWarnings().split("\n"));
            Long elapsed = t.getStatus() == ResumeTaskStatus.PROCESSING && t.getStartedAt() != null
                    ? Math.max(0, java.time.Duration.between(t.getStartedAt(), LocalDateTime.now()).toSeconds()) : null;
            return new TaskView(t.getId(), t.getFileName(), t.getStatus(), t.getStage(), t.getTotalAttempts(), t.getErrorCode(),
                    t.getErrorMessage(), t.isNeedsReview(), warnings, t.getCandidateId(), t.getCreatedAt(), t.getFinishedAt(), t.getRankRunAt(),
                    TaskNotes.of(t, maxAttempts), elapsed);
        }
    }
}
