package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Resume;
import com.project.ai_resumerag_be.enums.CommonResponseStatus;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.FileStorageService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final CandidateRepository candidateRepository;
    private final CandidateService candidateService;
    private final FileStorageService fileStorageService;

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @GetMapping("/{resumeId}")
    public ResponseEntity<CommonResponse> getResume(@PathVariable UUID resumeId) {
        Candidate candidate = ownedCandidateOf(resumeId);
        Resume resume = candidate.getResume();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", resume.getId());
        data.put("fileName", resume.getFileName());
        data.put("fileUrl", "/api/resumes/" + resume.getId() + "/file");
        data.put("extractedText", resume.getExtractedText());
        data.put("uploadedAt", resume.getUploadedAt());
        data.put("candidateId", candidate.getId());

        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(data)
                .message("Resume retrieved successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }

    @PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
    @Transactional
    @GetMapping("/{resumeId}/file")
    public ResponseEntity<Resource> downloadResume(@PathVariable UUID resumeId) {
        Resume resume = ownedCandidateOf(resumeId).getResume();
        File file = new File(fileStorageService.getFilePath(resume.getFileUrl()));
        if (!file.isFile()) {
            throw new ResourceNotFoundException("Resume file not found: " + resumeId);
        }
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(resume.getFileName()).build().toString())
                .body(new FileSystemResource(file));
    }

    private Candidate ownedCandidateOf(UUID resumeId) {
        Candidate candidate = candidateRepository.findByResumeId(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));
        // Re-resolve through the ownership check so other companies' resumes look like 404s.
        return candidateService.requireOwnedCandidate(candidate.getId());
    }
}
