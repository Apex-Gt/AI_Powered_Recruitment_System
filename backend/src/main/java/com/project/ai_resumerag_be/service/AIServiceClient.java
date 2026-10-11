package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.ai.*;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface AIServiceClient {

    Mono<AIServiceResponse<Void>> ingestResume(IngestResumeEvent event);

    Mono<AIServiceResponse<Void>> scoreJob(ScoreJobEvent event);

    Mono<AIServiceResponse<Void>> generateRAGSummary(RAGSummaryEvent event);

    Mono<AIServiceResponse<Void>> rankCandidates(RankCandidatesEvent event);

    Mono<AIServiceResponse<MatchScore>> getMatchScore(UUID candidateId, UUID jobId);

    Mono<AIServiceResponse<RAGSummary>> getRAGSummary(UUID candidateId, UUID jobId);

    Mono<AIServiceResponse<RankingResult>> getRanking(UUID jobId);

    Mono<AIServiceResponse<Void>> healthCheck();
}