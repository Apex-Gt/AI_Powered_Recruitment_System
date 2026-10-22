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
            Long estimatedSecondsRemaining) {
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
            LocalDateTime finishedAt) {

        static TaskView of(ResumeTask t) {
            List<String> warnings = t.getWarnings() == null || t.getWarnings().isBlank() ? List.of() : List.of(t.getWarnings().split("\n"));
            return new TaskView(t.getId(), t.getFileName(), t.getStatus(), t.getStage(), t.getTotalAttempts(), t.getErrorCode(),
                    t.getErrorMessage(), t.isNeedsReview(), warnings, t.getCandidateId(), t.getCreatedAt(), t.getFinishedAt());
        }
    }
}
