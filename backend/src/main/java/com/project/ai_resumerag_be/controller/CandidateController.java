package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.ai.AIServiceResponse;
import com.project.ai_resumerag_be.dto.ai.MatchScore;
import com.project.ai_resumerag_be.dto.ai.RAGSummary;
import com.project.ai_resumerag_be.dto.ai.RankingResult;
import com.project.ai_resumerag_be.dto.request.CandidateUploadRequest;
import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.service.CandidateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/recruiter/candidates")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService candidateService;

    @PreAuthorize("hasRole('RECRUITER')")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<ResponseEntity<CommonResponse>> uploadCandidateResume(
            @RequestPart("candidateName") String candidateName,
            @RequestPart("candidateEmail") String candidateEmail,
            @RequestPart(value = "phoneNumber", required = false) String phoneNumber,
            @RequestPart(value = "location", required = false) String location,
            @RequestPart("jobId") UUID jobId,
            @RequestPart("resumeFile") MultipartFile resumeFile) {

        CandidateUploadRequest request = CandidateUploadRequest.builder()
                .candidateName(candidateName)
                .candidateEmail(candidateEmail)
                .phoneNumber(phoneNumber)
                .location(location)
                .jobId(jobId)
                .resumeFile(resumeFile)
                .build();

        return candidateService.uploadCandidateResume(request)
                .map(response -> ResponseEntity.status(201).body(
                        CommonResponse.builder()
                                .code(201)
                                .data(response)
                                .message("Candidate resume uploaded successfully. Processing started.")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @PostMapping(value = "/bulk-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<ResponseEntity<CommonResponse>> bulkUploadCandidateResumes(
            @RequestPart("jobId") UUID jobId,
            @RequestPart("candidates") List<CandidateUploadRequest> candidates) {

        return candidateService.uploadBulkCandidateResumes(candidates)
                .map(responses -> ResponseEntity.status(201).body(
                        CommonResponse.builder()
                                .code(201)
                                .data(responses)
                                .message(String.format("Successfully uploaded %d candidate resumes. Processing started.", responses.size()))
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @PostMapping("/{candidateId}/score-job/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> scoreCandidateJob(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.triggerScoreJob(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response)
                                .message("Candidate scoring started")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @PostMapping("/{candidateId}/rag-summary/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> generateRAGSummary(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.triggerRAGSummary(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response)
                                .message("RAG summary generation started")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @PostMapping("/jobs/{jobId}/rank-candidates")
    public Mono<ResponseEntity<CommonResponse>> rankCandidates(
            @PathVariable UUID jobId,
            @RequestBody List<UUID> candidateIds) {

        return candidateService.triggerRankCandidates(jobId, candidateIds)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response)
                                .message("Candidate ranking started")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/{candidateId}/match-score/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> getMatchScore(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.getMatchScore(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response.getData())
                                .message("Match score retrieved successfully")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/{candidateId}/rag-summary/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> getRAGSummary(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.getRAGSummary(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response.getData())
                                .message("RAG summary retrieved successfully")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/jobs/{jobId}/ranking")
    public Mono<ResponseEntity<CommonResponse>> getRanking(
            @PathVariable UUID jobId) {

        return candidateService.getRanking(jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response.getData())
                                .message("Ranking retrieved successfully")
                                .build()));
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/ai-service/health")
    public Mono<ResponseEntity<CommonResponse>> healthCheck() {
        return candidateService.healthCheck()
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .data(response)
                                .message("AI service health check completed")
                                .build()));
    }
}