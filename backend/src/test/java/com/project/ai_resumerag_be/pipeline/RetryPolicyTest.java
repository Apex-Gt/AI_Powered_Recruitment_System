package com.project.ai_resumerag_be.pipeline;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class RetryPolicyTest {

    private final RetryPolicy noJitter = new RetryPolicy(5, Duration.ofSeconds(10), Duration.ofMinutes(5), () -> 0.5);

    @Test
    void delayDoublesWithEachAttempt() {
        assertEquals(Duration.ofSeconds(10), noJitter.delayAfter(1));
        assertEquals(Duration.ofSeconds(20), noJitter.delayAfter(2));
        assertEquals(Duration.ofSeconds(40), noJitter.delayAfter(3));
        assertEquals(Duration.ofSeconds(80), noJitter.delayAfter(4));
    }

    @Test
    void delayIsCapped() {
        assertEquals(Duration.ofMinutes(5), noJitter.delayAfter(12));
        assertEquals(Duration.ofMinutes(5), noJitter.delayAfter(500));
    }

    @Test
    void jitterStaysWithinTwentyPercent() {
        RetryPolicy low = new RetryPolicy(5, Duration.ofSeconds(100), Duration.ofHours(1), () -> 0.0);
        RetryPolicy high = new RetryPolicy(5, Duration.ofSeconds(100), Duration.ofHours(1), () -> 0.999999);
        assertEquals(80_000, low.delayAfter(1).toMillis());
        assertTrue(high.delayAfter(1).toMillis() <= 120_000 && high.delayAfter(1).toMillis() > 119_000);
    }

    @Test
    void retriesStopAtTheCap() {
        assertTrue(noJitter.canRetry(1));
        assertTrue(noJitter.canRetry(4));
        assertFalse(noJitter.canRetry(5));
        assertFalse(noJitter.canRetry(6));
    }

    @Test
    void atLeastOneAttemptIsAlwaysAllowed() {
        RetryPolicy zero = new RetryPolicy(0, Duration.ofSeconds(1), Duration.ofSeconds(1), () -> 0.5);
        assertEquals(1, zero.maxAttempts());
        assertFalse(zero.canRetry(1));
    }
}
