package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.ai.AIServiceResponse;
import com.project.ai_resumerag_be.dto.ai.MatchScore;
import com.project.ai_resumerag_be.dto.ai.RAGSummary;
import com.project.ai_resumerag_be.dto.ai.RankingResult;
import com.project.ai_resumerag_be.dto.request.CandidateUploadRequest;
import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

public interface CandidateService {

    Mono<CandidateResponse> uploadCandidateResume(CandidateUploadRequest request);

    Mono<List<CandidateResponse>> uploadBulkCandidateResumes(List<CandidateUploadRequest> requests);

    Mono<AIServiceResponse<Void>> triggerIngestResume(UUID candidateId, UUID resumeId, UUID jobId, String pdfPath);

    Mono<AIServiceResponse<Void>> triggerScoreJob(UUID candidateId, UUID jobId);

    Mono<AIServiceResponse<Void>> triggerRAGSummary(UUID candidateId, UUID jobId);

    Mono<AIServiceResponse<Void>> triggerRankCandidates(UUID jobId, List<UUID> candidateIds);

    Mono<AIServiceResponse<MatchScore>> getMatchScore(UUID candidateId, UUID jobId);

    Mono<AIServiceResponse<RAGSummary>> getRAGSummary(UUID candidateId, UUID jobId);

    Mono<AIServiceResponse<RankingResult>> getRanking(UUID jobId);

    Mono<AIServiceResponse<Void>> healthCheck();
}