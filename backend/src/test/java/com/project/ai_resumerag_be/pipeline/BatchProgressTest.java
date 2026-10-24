package com.project.ai_resumerag_be.pipeline;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BatchProgressTest {

    private static Map<ResumeTaskStatus, Long> counts(Object... pairs) {
        Map<ResumeTaskStatus, Long> map = new EnumMap<>(ResumeTaskStatus.class);
        for (int i = 0; i < pairs.length; i += 2) {
            map.put((ResumeTaskStatus) pairs[i], ((Number) pairs[i + 1]).longValue());
        }
        return map;
    }

    @Test
    void allWaitingIsQueued() {
        assertEquals(BatchStatus.QUEUED, BatchProgress.statusFor(counts(ResumeTaskStatus.QUEUED, 10), 10));
    }

    @Test
    void anyWorkInFlightIsProcessing() {
        assertEquals(BatchStatus.PROCESSING, BatchProgress.statusFor(counts(ResumeTaskStatus.QUEUED, 9, ResumeTaskStatus.PROCESSING, 1), 10));
        assertEquals(BatchStatus.PROCESSING, BatchProgress.statusFor(counts(ResumeTaskStatus.QUEUED, 5, ResumeTaskStatus.COMPLETED, 5), 10));
    }

    @Test
    void cleanFinishIsCompletedEvenWithDuplicatesSkipped() {
        assertEquals(BatchStatus.COMPLETED, BatchProgress.statusFor(counts(ResumeTaskStatus.COMPLETED, 8, ResumeTaskStatus.DUPLICATE, 2), 10));
    }

    @Test
    void failuresOrReviewsMakeItPartialNotFailed() {
        assertEquals(BatchStatus.PARTIAL, BatchProgress.statusFor(counts(ResumeTaskStatus.COMPLETED, 8, ResumeTaskStatus.FAILED, 2), 10));
        assertEquals(BatchStatus.PARTIAL, BatchProgress.statusFor(counts(ResumeTaskStatus.COMPLETED, 9, ResumeTaskStatus.NEEDS_REVIEW, 1), 10));
    }

    @Test
    void onlyFailureIsFailed() {
        assertEquals(BatchStatus.FAILED, BatchProgress.statusFor(counts(ResumeTaskStatus.FAILED, 10), 10));
    }

    @Test
    void aCancelledBatchStaysCancelledOnceNothingIsActive() {
        assertEquals(BatchStatus.CANCELLED, BatchProgress.statusFor(counts(ResumeTaskStatus.CANCELLED, 7, ResumeTaskStatus.DUPLICATE, 3), 10));
    }

    @Test
    void emptyBatchIsJustUploaded() {
        assertEquals(BatchStatus.UPLOADED, BatchProgress.statusFor(counts(), 0));
    }

    @Test
    void percentCountsFinalStatesOnly() {
        Map<ResumeTaskStatus, Long> c = counts(ResumeTaskStatus.COMPLETED, 3, ResumeTaskStatus.FAILED, 1, ResumeTaskStatus.QUEUED, 4, ResumeTaskStatus.PROCESSING, 2);
        assertEquals(40, BatchProgress.percent(c, 10));
        assertEquals(0, BatchProgress.percent(counts(), 0));
    }

    @Test
    void percentileUsesNearestRank() {
        List<Double> sorted = List.of(1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0);
        assertEquals(5.0, BatchProgress.percentile(sorted, 50));
        assertEquals(10.0, BatchProgress.percentile(sorted, 95));
        assertNull(BatchProgress.percentile(List.of(), 50));
    }

    @Test
    void throughputIsFinishedPerMinute() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 20, 10, 0, 0);
        assertEquals(12.0, BatchProgress.perMinute(60, start, start.plusMinutes(5)));
        assertNull(BatchProgress.perMinute(0, start, start.plusMinutes(5)));
    }

    @Test
    void latenciesOnlyCoverCompletedTasks() {
        LocalDateTime t0 = LocalDateTime.of(2026, 10, 20, 10, 0, 0);
        ResumeTask done = ResumeTask.builder().status(ResumeTaskStatus.COMPLETED).startedAt(t0).finishedAt(t0.plusSeconds(30)).build();
        ResumeTask failed = ResumeTask.builder().status(ResumeTaskStatus.FAILED).startedAt(t0).finishedAt(t0.plusSeconds(99)).build();
        assertEquals(List.of(30.0), BatchProgress.latenciesSeconds(List.of(done, failed)));
    }

    private static ResumeTask task(ResumeTaskStatus status, ResumeTaskStage stage, boolean ranking, LocalDateTime stageStart, LocalDateTime runAt) {
        return ResumeTask.builder().status(status).stage(stage).ranking(ranking).stageStartedAt(stageStart).rankRunAt(runAt).build();
    }

    @Test
    void aResumeAdvancesTheBarAsItMovesThroughItsStages() {
        LocalDateTime now = LocalDateTime.now();
        int queued = BatchProgress.weightedPercent(List.of(task(ResumeTaskStatus.QUEUED, ResumeTaskStage.EXTRACT, false, null, null)), now);
        int afterRead = BatchProgress.weightedPercent(List.of(task(ResumeTaskStatus.QUEUED, ResumeTaskStage.PROFILE, false, null, null)), now);
        int profiling = BatchProgress.weightedPercent(List.of(task(ResumeTaskStatus.PROCESSING, ResumeTaskStage.PROFILE, false, now.minusSeconds(20), null)), now);
        int saving = BatchProgress.weightedPercent(List.of(task(ResumeTaskStatus.QUEUED, ResumeTaskStage.PERSIST, false, null, null)), now);
        int done = BatchProgress.weightedPercent(List.of(task(ResumeTaskStatus.COMPLETED, ResumeTaskStage.DONE, false, null, null)), now);

        assertEquals(0, queued);
        assertEquals(10, afterRead);
        assertTrue(profiling > afterRead && profiling < saving, "moves inside the slow stage but never past it: " + profiling);
        assertEquals(90, saving);
        assertEquals(100, done);
    }

    @Test
    void aRunningStageNeverFillsTheBarByItself() {
        LocalDateTime now = LocalDateTime.now();
        int stuck = BatchProgress.weightedPercent(List.of(task(ResumeTaskStatus.PROCESSING, ResumeTaskStage.PROFILE, false, now.minusHours(1), null)), now);
        assertTrue(stuck < 90, "stays below the next stage: " + stuck);
    }

    @Test
    void aRankingRunStartsAtZeroAndCountsOnlyItsOwnResumes() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime run = now.minusMinutes(1);
        List<ResumeTask> tasks = List.of(
                task(ResumeTaskStatus.QUEUED, ResumeTaskStage.INDEX, true, null, run),
                task(ResumeTaskStatus.QUEUED, ResumeTaskStage.INDEX, true, null, run),
                task(ResumeTaskStatus.FAILED, ResumeTaskStage.PROFILE, false, null, null));
        assertEquals(0, BatchProgress.weightedPercent(tasks, now));

        List<ResumeTask> half = List.of(
                task(ResumeTaskStatus.COMPLETED, ResumeTaskStage.DONE, false, null, run),
                task(ResumeTaskStatus.QUEUED, ResumeTaskStage.INDEX, true, null, run),
                task(ResumeTaskStatus.FAILED, ResumeTaskStage.PROFILE, false, null, null));
        assertEquals(50, BatchProgress.weightedPercent(half, now));
    }

    @Test
    void rankingCountsCoverOnlyTheLatestRunAndSplitRankedFromFailed() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime earlier = now.minusHours(1);
        LocalDateTime run = now.minusMinutes(1);
        List<ResumeTask> tasks = List.of(
                task(ResumeTaskStatus.COMPLETED, ResumeTaskStage.DONE, false, null, earlier),   // an older run: not counted
                task(ResumeTaskStatus.COMPLETED, ResumeTaskStage.DONE, false, null, run),
                task(ResumeTaskStatus.FAILED, ResumeTaskStage.SUMMARY, false, null, run),
                task(ResumeTaskStatus.PROCESSING, ResumeTaskStage.SCORE, true, now, run),
                task(ResumeTaskStatus.COMPLETED, ResumeTaskStage.DONE, false, null, null));       // never ranked

        BatchProgress.RankingCounts counts = BatchProgress.rankingCounts(tasks);
        assertEquals(3, counts.total());
        assertEquals(1, counts.done());
        assertEquals(1, counts.failed());
        assertEquals(new BatchProgress.RankingCounts(0, 0, 0), BatchProgress.rankingCounts(List.of(task(ResumeTaskStatus.COMPLETED, ResumeTaskStage.DONE, false, null, null))));
    }
}
