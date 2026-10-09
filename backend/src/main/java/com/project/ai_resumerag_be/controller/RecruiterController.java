package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.JobRequest;
import com.project.ai_resumerag_be.dto.request.JobSkillRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.service.JobService;
import com.project.ai_resumerag_be.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/recruiter")
@RequiredArgsConstructor
public class RecruiterController {

    private final JobService jobService;
    private final UserService userService;

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/jobs")
    public ResponseEntity<CommonResponse> getMyJobs() {
        CommonResponse response = jobService.getMyJobs();
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<CommonResponse> getJobById(@PathVariable UUID jobId) {
        CommonResponse response = jobService.getJobByIdForRecruiter(jobId);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @GetMapping("/me")
    public ResponseEntity<CommonResponse> getCurrentUser() {
        CommonResponse response = userService.getCurrentUser();
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @PutMapping("/jobs/{jobId}")
    public ResponseEntity<CommonResponse> updateJob(@PathVariable UUID jobId, @Valid @RequestBody JobRequest request) {
        CommonResponse response = jobService.updateJobForRecruiter(jobId, request);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @DeleteMapping("/jobs/{jobId}")
    public ResponseEntity<CommonResponse> deleteJob(@PathVariable UUID jobId) {
        CommonResponse response = jobService.deleteJobForRecruiter(jobId);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('RECRUITER')")
    @PutMapping("/jobs/{jobId}/skills")
    public ResponseEntity<CommonResponse> updateJobSkills(@PathVariable UUID jobId, @Valid @RequestBody List<JobSkillRequest> skillRequests) {
        CommonResponse response = jobService.updateJobSkills(jobId, skillRequests);
        return ResponseEntity.status(response.getCode()).body(response);
    }
}