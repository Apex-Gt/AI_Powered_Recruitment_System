package com.project.ai_resumerag_be.pipeline;

import java.time.Duration;
import java.util.function.DoubleSupplier;

/**
 * Exponential backoff with jitter for transient failures. Pure logic, no clock and no randomness of its own,
 * so it is unit-testable.
 */
public class RetryPolicy {

    private final int maxAttempts;
    private final Duration baseDelay;
    private final Duration maxDelay;
    private final DoubleSupplier jitter; // returns [0,1)

    public RetryPolicy(PipelineProperties.Retry config) {
        this(config.getMaxAttempts(), config.getBaseDelay(), config.getMaxDelay(), Math::random);
    }

    public RetryPolicy(int maxAttempts, Duration baseDelay, Duration maxDelay, DoubleSupplier jitter) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
        this.jitter = jitter;
    }

    /** True while {@code attemptsMade} (including the one that just failed) leaves room for another try. */
    public boolean canRetry(int attemptsMade) {
        return attemptsMade < maxAttempts;
    }

    /** Wait before attempt number {@code attemptsMade + 1}: base * 2^(attemptsMade-1), capped, +/-20% jitter. */
    public Duration delayAfter(int attemptsMade) {
        int exponent = Math.max(0, Math.min(attemptsMade - 1, 20));
        long millis = Math.min(maxDelay.toMillis(), baseDelay.toMillis() * (1L << exponent));
        double factor = 0.8 + 0.4 * jitter.getAsDouble();
        return Duration.ofMillis(Math.min(maxDelay.toMillis(), Math.round(millis * factor)));
    }

    public int maxAttempts() {
        return maxAttempts;
    }
}
