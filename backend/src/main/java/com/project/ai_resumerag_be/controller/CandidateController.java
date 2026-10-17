package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.CandidateUpdateRequest;
import com.project.ai_resumerag_be.dto.request.CandidateUploadRequest;
import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.enumerators.ApplicationStatus;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
import com.project.ai_resumerag_be.mapper.CandidateMapper;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.enumerators.AiResultType;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.CandidateService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/recruiter/candidates")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService candidateService;
    private final CandidateRepository candidateRepository;
    private final CandidateMapper candidateMapper;
    private final AiResultStore aiResultStore;

    // ── Recruiter/Admin: list candidates ──────────────────────────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @GetMapping
    public ResponseEntity<CommonResponse> getCandidates(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID jobId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        List<Candidate> all;
        if (jobId != null) {
            all = candidateRepository.findByJobId(jobId);
        } else {
            all = candidateRepository.findAll();
        }

        // Filter by status
        if (status != null && !status.isBlank()) {
            try {
                ApplicationStatus appStatus = ApplicationStatus.valueOf(status.toUpperCase());
                all = all.stream().filter(c -> c.getStatus() == appStatus).collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {}
        }

        // Filter by search (name or email, case-insensitive)
        if (search != null && !search.isBlank()) {
            String q = search.toLowerCase();
            all = all.stream().filter(c ->
                    (c.getCandidateName() != null && c.getCandidateName().toLowerCase().contains(q))
                    || (c.getCandidateEmail() != null && c.getCandidateEmail().toLowerCase().contains(q))
            ).collect(Collectors.toList());
        }

        int total = all.size();
        int totalPages = (int) Math.ceil((double) total / pageSize);
        int fromIndex = Math.max(0, (page - 1) * pageSize);
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<Candidate> paged = all.subList(fromIndex, toIndex);

        List<CandidateResponse> data = paged.stream()
                .map(candidateMapper::toCandidateResponse)
                .peek(aiResultStore::enrich)
                .collect(Collectors.toList());

        Map<String, Object> responseData = new LinkedHashMap<>();
        responseData.put("data", data);
        responseData.put("total", total);
        responseData.put("page", page);
        responseData.put("pageSize", pageSize);
        responseData.put("totalPages", totalPages);

        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(responseData)
                .message("Candidates retrieved successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: get single candidate ─────────────────────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @GetMapping("/{candidateId}")
    public ResponseEntity<CommonResponse> getCandidateById(@PathVariable UUID candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found with id: " + candidateId));

        CandidateResponse response = candidateMapper.toCandidateResponse(candidate);
        aiResultStore.enrich(response);
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(response)
                .message("Candidate retrieved successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: AI analysis (match score + RAG summary produced after ingestion) ─────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @GetMapping("/{candidateId}/ai-analysis")
    public ResponseEntity<CommonResponse> getAiAnalysis(@PathVariable UUID candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found with id: " + candidateId));
        UUID jobId = candidate.getJob().getId();

        Optional<Map<String, Object>> score = aiResultStore.find(AiResultType.MATCH_SCORE, candidateId, jobId);
        if (score.isEmpty()) {
            return ResponseEntity.status(404).body(CommonResponse.builder()
                    .code(404)
                    .status(CommonResponseStatus.FAILURE)
                    .message("AI analysis is not ready yet")
                    .timestamp(LocalDateTime.now())
                    .build());
        }
        Map<String, Object> s = score.get();
        Map<String, Object> rag = aiResultStore.find(AiResultType.RAG_SUMMARY, candidateId, jobId).orElse(Map.of());

        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("skills", s.getOrDefault("skillMatchScore", 0));
        breakdown.put("experience", s.getOrDefault("experienceMatchScore", 0));
        breakdown.put("education", s.getOrDefault("educationMatchScore", 0));
        breakdown.put("jobRelevance", s.getOrDefault("semanticMatchScore", 0));

        Object summary = rag.get("summaryText");
        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("overallScore", s.getOrDefault("overallScore", 0));
        analysis.put("breakdown", breakdown);
        analysis.put("matchingSkills", s.getOrDefault("matchedSkills", List.of()));
        analysis.put("relevantExperience", rag.getOrDefault("relevantExperience", List.of()));
        analysis.put("potentialGaps", s.getOrDefault("missingSkills", List.of()));
        analysis.put("summary", summary != null ? summary : "Summary is still being generated.");
        analysis.put("generatedAt", rag.getOrDefault("generatedAt", s.get("createdAt")));

        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(analysis)
                .message("AI analysis retrieved successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: update status ────────────────────────────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @PatchMapping("/{candidateId}/status")
    public ResponseEntity<CommonResponse> updateCandidateStatus(
            @PathVariable UUID candidateId,
            @RequestBody Map<String, String> body) {

        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found with id: " + candidateId));

        String statusStr = body.get("status");
        if (statusStr == null || statusStr.isBlank()) {
            return ResponseEntity.badRequest().body(CommonResponse.builder()
                    .code(400)
                    .status(CommonResponseStatus.ERROR)
                    .message("Status is required")
                    .timestamp(LocalDateTime.now())
                    .build());
        }

        try {
            ApplicationStatus newStatus = ApplicationStatus.valueOf(statusStr.toUpperCase());
            candidate.setStatus(newStatus);
            candidateRepository.save(candidate);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(CommonResponse.builder()
                    .code(400)
                    .status(CommonResponseStatus.ERROR)
                    .message("Invalid status: " + statusStr)
                    .timestamp(LocalDateTime.now())
                    .build());
        }

        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(null)
                .message("Candidate status updated successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: edit candidate details ───────────────────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @PutMapping("/{candidateId}")
    public ResponseEntity<CommonResponse> updateCandidate(
            @PathVariable UUID candidateId,
            @Valid @RequestBody CandidateUpdateRequest request) {
        CandidateResponse updated = candidateService.updateCandidate(candidateId, request);
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(updated)
                .message("Candidate updated successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: delete candidate (and their resume) ──────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @DeleteMapping("/{candidateId}")
    public ResponseEntity<CommonResponse> deleteCandidate(@PathVariable UUID candidateId) {
        candidateService.deleteCandidate(candidateId);
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .message("Candidate deleted successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: shortlist ─────────────────────────────────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @PostMapping("/{candidateId}/shortlist")
    public ResponseEntity<CommonResponse> shortlistCandidate(@PathVariable UUID candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found with id: " + candidateId));
        candidate.setStatus(ApplicationStatus.SHORTLISTED);
        candidateRepository.save(candidate);
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(null)
                .message("Candidate shortlisted successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── Recruiter/Admin: reject ────────────────────────────────────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @PostMapping("/{candidateId}/reject")
    public ResponseEntity<CommonResponse> rejectCandidate(
            @PathVariable UUID candidateId,
            @RequestBody(required = false) Map<String, String> body) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found with id: " + candidateId));
        candidate.setStatus(ApplicationStatus.REJECTED);
        candidateRepository.save(candidate);
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(null)
                .message("Candidate rejected successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    // ── AI Service endpoints (roles updated to include ADMIN) ─────────────────

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
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
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response)
                                .message("Candidate resume uploaded successfully. Processing started.")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @PostMapping(value = "/bulk-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<ResponseEntity<CommonResponse>> bulkUploadCandidateResumes(
            @RequestPart("jobId") UUID jobId,
            @RequestPart("candidates") List<CandidateUploadRequest> candidates) {

        return candidateService.uploadBulkCandidateResumes(candidates)
                .map(responses -> ResponseEntity.status(201).body(
                        CommonResponse.builder()
                                .code(201)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(responses)
                                .message(String.format("Successfully uploaded %d candidate resumes. Processing started.", responses.size()))
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @PostMapping("/{candidateId}/score-job/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> scoreCandidateJob(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.triggerScoreJob(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response)
                                .message("Candidate scoring started")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @PostMapping("/{candidateId}/rag-summary/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> generateRAGSummary(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.triggerRAGSummary(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response)
                                .message("RAG summary generation started")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @PostMapping("/jobs/{jobId}/rank-candidates")
    public Mono<ResponseEntity<CommonResponse>> rankCandidates(
            @PathVariable UUID jobId,
            @RequestBody List<UUID> candidateIds) {

        return candidateService.triggerRankCandidates(jobId, candidateIds)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response)
                                .message("Candidate ranking started")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @GetMapping("/{candidateId}/match-score/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> getMatchScore(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.getMatchScore(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response.getData())
                                .message("Match score retrieved successfully")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @GetMapping("/{candidateId}/rag-summary/{jobId}")
    public Mono<ResponseEntity<CommonResponse>> getRAGSummary(
            @PathVariable UUID candidateId,
            @PathVariable UUID jobId) {

        return candidateService.getRAGSummary(candidateId, jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response.getData())
                                .message("RAG summary retrieved successfully")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @GetMapping("/jobs/{jobId}/ranking")
    public Mono<ResponseEntity<CommonResponse>> getRanking(
            @PathVariable UUID jobId) {

        return candidateService.getRanking(jobId)
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response.getData())
                                .message("Ranking retrieved successfully")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @GetMapping("/ai-service/health")
    public Mono<ResponseEntity<CommonResponse>> healthCheck() {
        return candidateService.healthCheck()
                .map(response -> ResponseEntity.ok(
                        CommonResponse.builder()
                                .code(200)
                                .status(CommonResponseStatus.SUCCESS)
                                .data(response)
                                .message("AI service health check completed")
                                .timestamp(LocalDateTime.now())
                                .build()));
    }
}
