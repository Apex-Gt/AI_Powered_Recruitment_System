package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.enumerators.AiResultType;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.CandidateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Server-to-server endpoints for the AI service (authenticated with X-API-Key, see SecurityConfig).
 * The service pushes its results here and reads back what it needs (candidate profile, job description,
 * earlier scores). Ingestion drives the rest of the pipeline: profile -> match score -> RAG summary.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class AICallbackController {

    private final AiResultStore store;
    private final CandidateRepository candidateRepository;
    private final CandidateService candidateService;

    // ── Results pushed by the AI service ──────────────────────────────────────

    @PostMapping("/ai/candidate-profile")
    public ResponseEntity<CommonResponse> receiveCandidateProfile(@RequestBody Map<String, Object> profile) {
        UUID candidateId = requireUuid(profile, "candidateId");
        log.info("Received candidate profile for candidate: {}", candidateId);
        store.save(AiResultType.PROFILE, candidateId, null, profile);

        // Profile is available, so the candidate can now be scored against the job they applied for.
        candidateRepository.findById(candidateId).ifPresentOrElse(
                candidate -> candidateService.triggerScoreJob(candidateId, candidate.getJob().getId())
                        .subscribe(
                                ok -> log.info("Scoring started for candidate {}", candidateId),
                                err -> log.warn("Could not start scoring for candidate {}: {}", candidateId, err.getMessage())),
                () -> log.warn("Profile received for unknown candidate {}", candidateId));

        return ok("Candidate profile received successfully");
    }

    @PostMapping("/ai/match-scores")
    public ResponseEntity<CommonResponse> receiveMatchScore(@RequestBody Map<String, Object> matchScore) {
        UUID candidateId = requireUuid(matchScore, "candidateId");
        UUID jobId = requireUuid(matchScore, "jobId");
        log.info("Received match score for candidate: {} job: {}", candidateId, jobId);
        store.save(AiResultType.MATCH_SCORE, candidateId, jobId, matchScore);

        candidateService.triggerRAGSummary(candidateId, jobId)
                .subscribe(
                        ok -> log.info("RAG summary started for candidate {}", candidateId),
                        err -> log.warn("Could not start RAG summary for candidate {}: {}", candidateId, err.getMessage()));

        return ok("Match score received successfully");
    }

    @PostMapping("/ai/rag-summaries")
    public ResponseEntity<CommonResponse> receiveRAGSummary(@RequestBody Map<String, Object> ragSummary) {
        UUID candidateId = requireUuid(ragSummary, "candidateId");
        UUID jobId = requireUuid(ragSummary, "jobId");
        log.info("Received RAG summary for candidate: {} job: {}", candidateId, jobId);
        store.save(AiResultType.RAG_SUMMARY, candidateId, jobId, ragSummary);
        return ok("RAG summary received successfully");
    }

    @PostMapping("/ai/rankings/{jobId}")
    public ResponseEntity<CommonResponse> receiveRanking(
            @PathVariable UUID jobId,
            @RequestBody Map<String, Object> ranking) {
        log.info("Received ranking for job: {} with {} candidates", jobId, ranking.get("totalCandidates"));
        store.save(AiResultType.RANKING, null, jobId, ranking);
        return ok("Ranking received successfully");
    }

    // ── Data the AI service reads back ────────────────────────────────────────

    @GetMapping("/ai/match-scores/{candidateId}/{jobId}")
    public ResponseEntity<CommonResponse> getMatchScore(@PathVariable UUID candidateId, @PathVariable UUID jobId) {
        return found(store.find(AiResultType.MATCH_SCORE, candidateId, jobId), "Match score not found");
    }

    @GetMapping("/ai/rag-summaries/{candidateId}/{jobId}")
    public ResponseEntity<CommonResponse> getRAGSummary(@PathVariable UUID candidateId, @PathVariable UUID jobId) {
        return found(store.find(AiResultType.RAG_SUMMARY, candidateId, jobId), "RAG summary not found");
    }

    @GetMapping("/ai/rankings/{jobId}")
    public ResponseEntity<CommonResponse> getRanking(@PathVariable UUID jobId) {
        return found(store.find(AiResultType.RANKING, null, jobId), "Ranking not found");
    }

    @GetMapping("/candidates/{candidateId}/profile")
    public ResponseEntity<CommonResponse> getCandidateProfile(@PathVariable UUID candidateId) {
        return found(store.find(AiResultType.PROFILE, candidateId, null), "Candidate profile not found");
    }

    @GetMapping("/jobs/{jobId}/description")
    public ResponseEntity<CommonResponse> getJobDescription(@PathVariable UUID jobId) {
        return found(Optional.of(candidateService.getJobDescription(jobId)), "Job not found");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static UUID requireUuid(Map<String, Object> body, String field) {
        Object value = body.get(field);
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Missing or invalid '" + field + "'");
        }
    }

    private static ResponseEntity<CommonResponse> ok(String message) {
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build());
    }

    private static ResponseEntity<CommonResponse> found(Optional<?> data, String notFoundMessage) {
        if (data.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(CommonResponse.builder()
                    .code(404)
                    .status(CommonResponseStatus.FAILURE)
                    .message(notFoundMessage)
                    .timestamp(LocalDateTime.now())
                    .build());
        }
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(data.get())
                .timestamp(LocalDateTime.now())
                .build());
    }
}
