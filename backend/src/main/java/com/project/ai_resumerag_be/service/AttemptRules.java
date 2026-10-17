package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.entity.AssessmentAttempt;
import com.project.ai_resumerag_be.entity.AttemptAnswer;
import com.project.ai_resumerag_be.enumerators.AttemptStatus;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/** Token handling and state rules shared by the recruiter and candidate-facing assessment services. */
final class AttemptRules {

    /** Extra time after the limit so a browser auto-submit at 00:00 is still accepted. */
    static final int GRACE_MINUTES = 2;

    private static final SecureRandom RANDOM = new SecureRandom();

    private AttemptRules() {
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The moment a running attempt stops accepting answers; null until it has started. */
    static LocalDateTime deadline(AssessmentAttempt attempt) {
        if (attempt.getStartedAt() == null) {
            return null;
        }
        LocalDateTime byDuration = attempt.getStartedAt()
                .plusMinutes(attempt.getAssessment().getDuration() + GRACE_MINUTES);
        return byDuration.isBefore(attempt.getExpiresAt()) ? byDuration : attempt.getExpiresAt();
    }

    /** Stored status, except that an attempt nobody finished in time reads as EXPIRED. */
    static AttemptStatus effectiveStatus(AssessmentAttempt attempt, LocalDateTime now) {
        return switch (attempt.getStatus()) {
            case ASSIGNED -> now.isAfter(attempt.getExpiresAt()) ? AttemptStatus.EXPIRED : AttemptStatus.ASSIGNED;
            case IN_PROGRESS -> now.isAfter(deadline(attempt)) ? AttemptStatus.EXPIRED : AttemptStatus.IN_PROGRESS;
            default -> attempt.getStatus();
        };
    }

    /**
     * After a submission or a manual grade: GRADED with the weighted average once every answer has a score,
     * otherwise SUBMITTED with no total.
     */
    static void recompute(AssessmentAttempt attempt) {
        if (attempt.getStatus() != AttemptStatus.SUBMITTED && attempt.getStatus() != AttemptStatus.GRADED) {
            return;
        }
        double weighted = 0;
        double weights = 0;
        for (AttemptAnswer answer : attempt.getAnswers()) {
            if (answer.getScore() == null) {
                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setTotalScore(null);
                return;
            }
            int weight = answer.getQuestion().getWeight();
            weighted += answer.getScore() * weight;
            weights += weight;
        }
        attempt.setStatus(AttemptStatus.GRADED);
        attempt.setTotalScore(weights == 0 ? 0.0 : Math.round(weighted / weights * 10.0) / 10.0);
    }
}
