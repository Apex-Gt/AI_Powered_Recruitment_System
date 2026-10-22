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
}
