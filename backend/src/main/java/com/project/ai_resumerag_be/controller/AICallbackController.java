package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.ai.AIServiceResponse;
import com.project.ai_resumerag_be.dto.ai.MatchScore;
import com.project.ai_resumerag_be.dto.ai.RAGSummary;
import com.project.ai_resumerag_be.dto.ai.RankingResult;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AICallbackController {

    private final CandidateRepository candidateRepository;
    private final JobRepository jobRepository;

    @PostMapping("/match-scores")
    public ResponseEntity<CommonResponse> receiveMatchScore(@RequestBody MatchScore matchScore) {
        log.info("Received match score for candidate: {} job: {}", matchScore.getCandidateId(), matchScore.getJobId());
        return ResponseEntity.ok(
                CommonResponse.builder()
                        .code(200)
                        .message("Match score received successfully")
                        .build());
    }

    @PostMapping("/rag-summaries")
    public ResponseEntity<CommonResponse> receiveRAGSummary(@RequestBody RAGSummary ragSummary) {
        log.info("Received RAG summary for candidate: {} job: {}", ragSummary.getCandidateId(), ragSummary.getJobId());
        return ResponseEntity.ok(
                CommonResponse.builder()
                        .code(200)
                        .message("RAG summary received successfully")
                        .build());
    }

    @PostMapping("/rankings/{jobId}")
    public ResponseEntity<CommonResponse> receiveRanking(
            @PathVariable UUID jobId,
            @RequestBody RankingResult rankingResult) {
        log.info("Received ranking for job: {} with {} candidates", jobId, rankingResult.getTotalCandidates());
        return ResponseEntity.ok(
                CommonResponse.builder()
                        .code(200)
                        .message("Ranking received successfully")
                        .build());
    }

    @PostMapping("/candidate-profile")
    public ResponseEntity<CommonResponse> receiveCandidateProfile(@RequestBody Object profile) {
        log.info("Received candidate profile callback");
        return ResponseEntity.ok(
                CommonResponse.builder()
                        .code(200)
                        .message("Candidate profile received successfully")
                        .build());
    }
}