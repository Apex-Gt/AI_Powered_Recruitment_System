package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.CompanyRequest;
import com.project.ai_resumerag_be.dto.request.JobRequest;
import com.project.ai_resumerag_be.dto.request.JobSkillRequest;
import com.project.ai_resumerag_be.dto.request.RecruiterRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.service.CompanyService;
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
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final CompanyService companyService;
    private final JobService jobService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/recruiters")
    public ResponseEntity<CommonResponse> createRecruiter(@Valid @RequestBody RecruiterRequest recruiterRequest) {
        CommonResponse response = userService.createRecruiterUser(recruiterRequest);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/recruiters")
    public ResponseEntity<CommonResponse> getRecruiters() {
        CommonResponse response = userService.getRecruitersForAdmin();
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/recruiters/{recruiterId}")
    public ResponseEntity<CommonResponse> getRecruiterById(@PathVariable UUID recruiterId) {
        CommonResponse response = userService.getRecruiterByIdForAdmin(recruiterId);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/company")
    public ResponseEntity<CommonResponse> getCompany() {
        CommonResponse response = companyService.getCompanyForAdmin();
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/jobs")
    public ResponseEntity<CommonResponse> getAllJobs() {
        CommonResponse response = jobService.getAllJobsForAdmin();
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<CommonResponse> getJobById(@PathVariable UUID jobId) {
        CommonResponse response = jobService.getJobByIdForAdmin(jobId);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/company")
    public ResponseEntity<CommonResponse> updateCompany(@Valid @RequestBody CompanyRequest request) {
        CommonResponse response = companyService.updateCompanyForAdmin(request);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/recruiters/{recruiterId}")
    public ResponseEntity<CommonResponse> updateRecruiter(@PathVariable UUID recruiterId, @Valid @RequestBody RecruiterRequest request) {
        CommonResponse response = userService.updateRecruiterForAdmin(recruiterId, request);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/jobs/{jobId}")
    public ResponseEntity<CommonResponse> updateJob(@PathVariable UUID jobId, @Valid @RequestBody JobRequest request) {
        CommonResponse response = jobService.updateJobForAdmin(jobId, request);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/recruiters/{recruiterId}")
    public ResponseEntity<CommonResponse> deleteRecruiter(@PathVariable UUID recruiterId) {
        CommonResponse response = userService.deleteRecruiterForAdmin(recruiterId);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/jobs/{jobId}")
    public ResponseEntity<CommonResponse> deleteJob(@PathVariable UUID jobId) {
        CommonResponse response = jobService.deleteJobForAdmin(jobId);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/jobs/{jobId}/skills")
    public ResponseEntity<CommonResponse> updateJobSkills(@PathVariable UUID jobId, @Valid @RequestBody List<JobSkillRequest> skillRequests) {
        CommonResponse response = jobService.updateJobSkills(jobId, skillRequests);
        return ResponseEntity.status(response.getCode()).body(response);
    }
}