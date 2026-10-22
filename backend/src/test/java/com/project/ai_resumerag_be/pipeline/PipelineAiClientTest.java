package com.project.ai_resumerag_be.pipeline;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatusCode;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** The AI service's error contract decides whether the queue retries, fails, or parks a resume. */
class PipelineAiClientTest {

    private static StageFailure classify(int status, Map<String, Object> body) {
        return PipelineAiClient.classify(HttpStatusCode.valueOf(status), body);
    }

    @Test
    void unavailableDependencyIsRetried() {
        StageFailure f = classify(503, Map.of("code", "LLM_UNAVAILABLE", "message", "down", "retryable", true));
        assertEquals(StageFailure.Kind.TRANSIENT, f.kind());
        assertEquals("LLM_UNAVAILABLE", f.code());
    }

    @Test
    void badDocumentIsNotRetried() {
        StageFailure f = classify(422, Map.of("code", "ENCRYPTED_FILE", "message", "locked", "retryable", false));
        assertEquals(StageFailure.Kind.PERMANENT, f.kind());
        assertEquals("ENCRYPTED_FILE", f.code());
    }

    @Test
    void needsReviewIsParkedNotFailed() {
        StageFailure f = classify(422, Map.of("code", "SCANNED_PDF", "message", "scan", "retryable", false, "needsReview", true));
        assertEquals(StageFailure.Kind.NEEDS_REVIEW, f.kind());
    }

    @Test
    void serverErrorsWithoutAContractAreTransient() {
        assertEquals(StageFailure.Kind.TRANSIENT, classify(500, Map.of()).kind());
        assertEquals(StageFailure.Kind.TRANSIENT, classify(502, Map.of()).kind());
        assertEquals(StageFailure.Kind.TRANSIENT, classify(429, Map.of()).kind());
    }

    @Test
    void keyMismatchStaysQueuedUntilFixed() {
        StageFailure f = classify(401, Map.of("detail", "Invalid or missing API key"));
        assertEquals(StageFailure.Kind.TRANSIENT, f.kind());
        assertEquals("AI_SERVICE_AUTH", f.code());
    }

    @Test
    void otherClientErrorsAreRequestBugsNotRetried() {
        assertEquals(StageFailure.Kind.PERMANENT, classify(400, Map.of("detail", "bad request")).kind());
    }
}
