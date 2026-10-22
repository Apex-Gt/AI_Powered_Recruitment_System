package com.project.ai_resumerag_be.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

/**
 * Blocking client for the AI service's staged pipeline endpoints (called from worker threads, never from a
 * request thread). Translates every outcome into either a result map or a {@link StageFailure} that says
 * whether the queue should retry, fail, or park the resume for review.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PipelineAiClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};

    private final WebClient aiServiceWebClient;
    private final PipelineProperties properties;

    public Map<String, Object> extract(String filePath, String fileName) {
        return post("/api/v1/pipeline/extract", Map.of("filePath", filePath, "fileName", nz(fileName)), properties.getAi().getExtractTimeout());
    }

    public Map<String, Object> profile(String filePath, String fileName) {
        return post("/api/v1/pipeline/profile", Map.of("filePath", filePath, "fileName", nz(fileName)), properties.getAi().getProfileTimeout());
    }

    public Map<String, Object> index(UUID candidateId, UUID resumeId, UUID jobId, String filePath, String fileName) {
        Map<String, Object> body = new HashMap<>();
        body.put("candidateId", candidateId.toString());
        body.put("resumeId", resumeId.toString());
        body.put("jobId", jobId.toString());
        body.put("filePath", filePath);
        body.put("fileName", nz(fileName));
        return post("/api/v1/pipeline/index", body, properties.getAi().getIndexTimeout());
    }

    public Map<String, Object> score(UUID candidateId, String filePath, Object job, Map<String, Object> profile) {
        Map<String, Object> body = new HashMap<>();
        body.put("candidateId", candidateId.toString());
        body.put("filePath", filePath);
        body.put("job", job);
        body.put("profile", profile);
        return post("/api/v1/pipeline/score", body, properties.getAi().getScoreTimeout());
    }

    public Map<String, Object> summary(UUID candidateId, String filePath, Object job, Map<String, Object> profile, Map<String, Object> matchScore) {
        Map<String, Object> body = new HashMap<>();
        body.put("candidateId", candidateId.toString());
        body.put("filePath", filePath);
        body.put("job", job);
        body.put("profile", profile);
        if (matchScore != null) {
            body.put("matchScore", matchScore);
        }
        return post("/api/v1/pipeline/summary", body, properties.getAi().getSummaryTimeout());
    }

    private Map<String, Object> post(String path, Object body, Duration timeout) {
        try {
            WebClient.RequestBodySpec request = aiServiceWebClient.post().uri(path).headers(h -> {
                String key = properties.getAi().getApiKey();
                if (key != null && !key.isBlank()) {
                    h.set("X-API-Key", key);
                }
            });
            return request.bodyValue(body)
                    .exchangeToMono(response -> response.bodyToMono(MAP)
                            .defaultIfEmpty(Map.of())
                            .map(payload -> {
                                if (response.statusCode().is2xxSuccessful()) {
                                    return payload;
                                }
                                throw classify(response.statusCode(), payload);
                            }))
                    .block(timeout.plusSeconds(5));
        } catch (StageFailure e) {
            throw e;
        } catch (RuntimeException e) {
            Throwable root = rootCause(e);
            if (root instanceof TimeoutException || e.getClass().getSimpleName().contains("Timeout") || root instanceof java.io.IOException
                    || e instanceof WebClientRequestException || (e.getMessage() != null && e.getMessage().contains("Timeout on blocking read"))) {
                throw new StageFailure(StageFailure.Kind.TRANSIENT, "AI_SERVICE_UNAVAILABLE",
                        "The AI service did not answer in time or could not be reached", e);
            }
            throw new StageFailure(StageFailure.Kind.TRANSIENT, "AI_SERVICE_ERROR", "Unexpected AI service error: " + e.getMessage(), e);
        }
    }

    /** Maps the AI service's error contract ({code, message, retryable, needsReview}) onto a StageFailure. */
    static StageFailure classify(HttpStatusCode status, Map<String, Object> payload) {
        String code = payload.get("code") instanceof String c ? c : "AI_SERVICE_ERROR";
        String message = payload.get("message") instanceof String m ? m
                : payload.get("detail") instanceof String d ? d : "AI service returned " + status.value();
        boolean retryable = Boolean.TRUE.equals(payload.get("retryable"));
        boolean review = Boolean.TRUE.equals(payload.get("needsReview"));

        if (status.value() == 401 || status.value() == 403) {
            // A key mismatch is a deployment problem, not a bad resume: keep the work queued so it resumes once fixed.
            return StageFailure.transientFailure("AI_SERVICE_AUTH", "The AI service rejected the backend's API key");
        }
        if (review) {
            return StageFailure.needsReview(code, message);
        }
        if (retryable || status.is5xxServerError() || status.value() == 429) {
            return StageFailure.transientFailure(code, message);
        }
        return StageFailure.permanent(code, message);
    }

    private static Throwable rootCause(Throwable t) {
        Throwable cur = t;
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        return cur;
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }
}
