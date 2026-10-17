package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.ai.*;
import com.project.ai_resumerag_be.service.AIServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIServiceClientImplementation implements AIServiceClient {

    private final WebClient aiServiceWebClient;

    private static final ParameterizedTypeReference<AIServiceResponse<Void>> VOID_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<AIServiceResponse<MatchScore>> MATCH_SCORE_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<AIServiceResponse<RAGSummary>> RAG_SUMMARY_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<AIServiceResponse<RankingResult>> RANKING_RESULT_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};

    @Override
    public Mono<AIServiceResponse<Void>> ingestResume(IngestResumeEvent event) {
        log.info("Sending ingest resume event for candidate: {}", event.getCandidateId());
        return aiServiceWebClient.post()
                .uri("/api/v1/resumes/ingest")
                .bodyValue(event)
                .retrieve()
                .bodyToMono(VOID_RESPONSE_TYPE)
                .timeout(Duration.ofMinutes(5))
                .doOnSuccess(response -> log.info("Ingest resume response: {}", response.getStatus()))
                .doOnError(error -> log.error("Ingest resume failed: {}", error.getMessage()));
    }

    @Override
    public Mono<AIServiceResponse<Void>> scoreJob(ScoreJobEvent event) {
        log.info("Sending score job event for candidate: {} job: {}", event.getCandidateId(), event.getJobId());
        return aiServiceWebClient.post()
                .uri("/api/v1/candidates/score-job")
                .bodyValue(event)
                .retrieve()
                .bodyToMono(VOID_RESPONSE_TYPE)
                .timeout(Duration.ofMinutes(5))
                .doOnSuccess(response -> log.info("Score job response: {}", response.getStatus()))
                .doOnError(error -> log.error("Score job failed: {}", error.getMessage()));
    }

    @Override
    public Mono<AIServiceResponse<Void>> generateRAGSummary(RAGSummaryEvent event) {
        log.info("Sending RAG summary event for candidate: {} job: {}", event.getCandidateId(), event.getJobId());
        return aiServiceWebClient.post()
                .uri("/api/v1/candidates/rag-summary")
                .bodyValue(event)
                .retrieve()
                .bodyToMono(VOID_RESPONSE_TYPE)
                .timeout(Duration.ofMinutes(5))
                .doOnSuccess(response -> log.info("RAG summary response: {}", response.getStatus()))
                .doOnError(error -> log.error("RAG summary failed: {}", error.getMessage()));
    }

    @Override
    public Mono<AIServiceResponse<Void>> rankCandidates(RankCandidatesEvent event) {
        log.info("Sending rank candidates event for job: {} candidates: {}", event.getJobId(), event.getCandidateIds().size());
        return aiServiceWebClient.post()
                .uri("/api/v1/jobs/rank-candidates")
                .bodyValue(event)
                .retrieve()
                .bodyToMono(VOID_RESPONSE_TYPE)
                .timeout(Duration.ofMinutes(5))
                .doOnSuccess(response -> log.info("Rank candidates response: {}", response.getStatus()))
                .doOnError(error -> log.error("Rank candidates failed: {}", error.getMessage()));
    }

    @Override
    public Mono<AIServiceResponse<MatchScore>> getMatchScore(UUID candidateId, UUID jobId) {
        log.info("Fetching match score for candidate: {} job: {}", candidateId, jobId);
        return aiServiceWebClient.get()
                .uri("/api/v1/candidates/{candidateId}/match-score/{jobId}", candidateId, jobId)
                .retrieve()
                .bodyToMono(MATCH_SCORE_RESPONSE_TYPE)
                .timeout(Duration.ofSeconds(30))
                .doOnError(error -> log.error("Get match score failed: {}", error.getMessage()));
    }

    @Override
    public Mono<AIServiceResponse<RAGSummary>> getRAGSummary(UUID candidateId, UUID jobId) {
        log.info("Fetching RAG summary for candidate: {} job: {}", candidateId, jobId);
        return aiServiceWebClient.get()
                .uri("/api/v1/candidates/{candidateId}/rag-summary/{jobId}", candidateId, jobId)
                .retrieve()
                .bodyToMono(RAG_SUMMARY_RESPONSE_TYPE)
                .timeout(Duration.ofSeconds(30))
                .doOnError(error -> log.error("Get RAG summary failed: {}", error.getMessage()));
    }

    @Override
    public Mono<AIServiceResponse<RankingResult>> getRanking(UUID jobId) {
        log.info("Fetching ranking for job: {}", jobId);
        return aiServiceWebClient.get()
                .uri("/api/v1/jobs/{jobId}/ranking", jobId)
                .retrieve()
                .bodyToMono(RANKING_RESULT_RESPONSE_TYPE)
                .timeout(Duration.ofSeconds(30))
                .doOnError(error -> log.error("Get ranking failed: {}", error.getMessage()));
    }

    @Override
    public Mono<Void> deleteCandidate(UUID candidateId) {
        log.info("Deleting AI data for candidate: {}", candidateId);
        return aiServiceWebClient.delete()
                .uri("/api/v1/candidates/{id}", candidateId)
                .retrieve()
                .toBodilessEntity()
                .timeout(Duration.ofSeconds(30))
                .then();
    }

    @Override
    public Mono<AIServiceResponse<Void>> healthCheck() {
        log.info("Checking AI service health");
        return aiServiceWebClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(VOID_RESPONSE_TYPE)
                .timeout(Duration.ofSeconds(10))
                .doOnSuccess(response -> log.info("AI service health: {}", response.getStatus()))
                .doOnError(error -> log.error("AI service health check failed: {}", error.getMessage()));
    }
}