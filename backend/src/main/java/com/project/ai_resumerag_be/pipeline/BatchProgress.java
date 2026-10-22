package com.project.ai_resumerag_be.pipeline;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Derives batch status and throughput numbers from per-task counts and timings. Pure functions. */
public final class BatchProgress {

    private BatchProgress() {
    }

    public static BatchStatus statusFor(Map<ResumeTaskStatus, Long> counts, int total) {
        long queued = count(counts, ResumeTaskStatus.QUEUED) + count(counts, ResumeTaskStatus.UPLOADED);
        long processing = count(counts, ResumeTaskStatus.PROCESSING);
        long failed = count(counts, ResumeTaskStatus.FAILED);
        long review = count(counts, ResumeTaskStatus.NEEDS_REVIEW);
        long done = count(counts, ResumeTaskStatus.COMPLETED);
        long duplicates = count(counts, ResumeTaskStatus.DUPLICATE);
        long finished = failed + review + done + duplicates;

        if (total == 0) {
            return BatchStatus.UPLOADED;
        }
        if (queued + processing > 0) {
            return processing == 0 && finished == 0 ? BatchStatus.QUEUED : BatchStatus.PROCESSING;
        }
        if (failed > 0 && done + review == 0) {
            return BatchStatus.FAILED;
        }
        return failed + review > 0 ? BatchStatus.PARTIAL : BatchStatus.COMPLETED;
    }

    /** Share of resumes that reached a final state, 0-100. */
    public static int percent(Map<ResumeTaskStatus, Long> counts, int total) {
        if (total <= 0) {
            return 0;
        }
        long finished = 0;
        for (ResumeTaskStatus status : ResumeTaskStatus.values()) {
            if (!status.isActive()) {
                finished += count(counts, status);
            }
        }
        return (int) Math.min(100, Math.round(finished * 100.0 / total));
    }

    /** Wall-clock seconds per finished task, for the batch's own p50 / p95 latency figures. */
    public static List<Double> latenciesSeconds(List<ResumeTask> tasks) {
        return tasks.stream()
                .filter(t -> t.getStartedAt() != null && t.getFinishedAt() != null && t.getStatus() == ResumeTaskStatus.COMPLETED)
                .map(t -> Duration.between(t.getStartedAt(), t.getFinishedAt()).toMillis() / 1000.0)
                .sorted()
                .toList();
    }

    /** Nearest-rank percentile of a sorted list; null when empty. */
    public static Double percentile(List<Double> sorted, double p) {
        if (sorted.isEmpty()) {
            return null;
        }
        int rank = (int) Math.ceil(p / 100.0 * sorted.size());
        return sorted.get(Math.max(0, Math.min(sorted.size() - 1, rank - 1)));
    }

    public static Double perMinute(long finished, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || finished == 0) {
            return null;
        }
        double minutes = Duration.between(from, to).toMillis() / 60000.0;
        return minutes <= 0 ? null : Math.round(finished / minutes * 100.0) / 100.0;
    }

    private static long count(Map<ResumeTaskStatus, Long> counts, ResumeTaskStatus status) {
        return counts.getOrDefault(status, 0L);
    }
}
