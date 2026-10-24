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
        long cancelled = count(counts, ResumeTaskStatus.CANCELLED);
        long finished = failed + review + done + duplicates + cancelled;

        if (total == 0) {
            return BatchStatus.UPLOADED;
        }
        if (queued + processing > 0) {
            return processing == 0 && finished == 0 ? BatchStatus.QUEUED : BatchStatus.PROCESSING;
        }
        if (cancelled > 0) {
            return BatchStatus.CANCELLED;
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

    /** Share of the work in each stage, so a bar moves as a resume passes through them rather than jumping at the end. */
    private static double weight(ResumeTaskStage stage, boolean ranking) {
        if (ranking) {
            return switch (stage) {
                case INDEX -> 0.25;
                case SCORE -> 0.15;
                case SUMMARY -> 0.60;
                default -> 0;
            };
        }
        return switch (stage) {
            case EXTRACT -> 0.10;
            case PROFILE -> 0.80;
            case PERSIST -> 0.10;
            default -> 0;
        };
    }

    /** Seconds after which a running stage is "most of the way"; the bar creeps toward, and never reaches, the stage's end. */
    private static double typicalSeconds(ResumeTaskStage stage) {
        return switch (stage) {
            case EXTRACT -> 3;
            case PROFILE -> 25;
            case PERSIST -> 1;
            case INDEX -> 10;
            case SCORE -> 5;
            case SUMMARY -> 30;
            default -> 1;
        };
    }

    /** How far through its work one resume is, 0-1, from the stage it is in and how long that stage has been running. */
    static double fraction(ResumeTask task, boolean ranking, LocalDateTime now) {
        if (!task.getStatus().isActive()) {
            return 1.0;
        }
        ResumeTaskStage current = task.getStage();
        double done = 0;
        for (ResumeTaskStage stage : ResumeTaskStage.values()) {
            if (stage.ordinal() >= current.ordinal()) {
                break;
            }
            done += weight(stage, ranking);
        }
        if (task.getStatus() == ResumeTaskStatus.PROCESSING && task.getStageStartedAt() != null) {
            double elapsed = Math.max(0, Duration.between(task.getStageStartedAt(), now).toMillis() / 1000.0);
            done += weight(current, ranking) * 0.9 * (1 - Math.exp(-elapsed / typicalSeconds(current)));
        }
        return Math.min(1.0, done);
    }

    /**
     * Progress of the work in hand, 0-100: the average of each resume's own progress. While a ranking run is going it
     * covers that run's resumes only, so ranking starts at 0 instead of at whatever share was already read.
     */
    public static int weightedPercent(List<ResumeTask> tasks, LocalDateTime now) {
        boolean ranking = tasks.stream().anyMatch(t -> t.getStatus().isActive() && t.isRanking());
        List<ResumeTask> run = rankingRun(tasks);
        List<ResumeTask> scope = ranking && !run.isEmpty() ? run : tasks;
        if (scope.isEmpty()) {
            return 0;
        }
        double sum = 0;
        for (ResumeTask task : scope) {
            sum += fraction(task, ranking && task.isRanking(), now);
        }
        return (int) Math.min(100, Math.floor(sum * 100.0 / scope.size()));
    }

    /** The resumes queued by the latest "Rank candidates" press of this batch; empty when it was never ranked. */
    public static List<ResumeTask> rankingRun(List<ResumeTask> tasks) {
        LocalDateTime run = tasks.stream().map(ResumeTask::getRankRunAt).filter(java.util.Objects::nonNull)
                .max(LocalDateTime::compareTo).orElse(null);
        return run == null ? List.of() : tasks.stream().filter(t -> run.equals(t.getRankRunAt())).toList();
    }

    /** How the latest ranking run is going: all resumes in it, those ranked, and those that failed. */
    public record RankingCounts(long total, long done, long failed) {
    }

    public static RankingCounts rankingCounts(List<ResumeTask> tasks) {
        List<ResumeTask> run = rankingRun(tasks);
        long done = run.stream().filter(t -> t.getStatus() == ResumeTaskStatus.COMPLETED || t.getStatus() == ResumeTaskStatus.NEEDS_REVIEW).count();
        long failed = run.stream().filter(t -> t.getStatus() == ResumeTaskStatus.FAILED).count();
        return new RankingCounts(run.size(), done, failed);
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
