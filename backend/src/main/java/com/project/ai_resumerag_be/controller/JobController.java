package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.request.JobRequest;
import com.project.ai_resumerag_be.service.JobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/job")
public class JobController {

    private final JobService jobService;

    @PreAuthorize("hasAnyRole('RECRUITER', 'ADMIN')")
    @PostMapping
    public ResponseEntity<CommonResponse> createJob(@Valid @RequestBody JobRequest request) {
        CommonResponse response = jobService.createJob(request);
        return ResponseEntity.status(response.getCode()).body(response);
    }

    @PreAuthorize("hasAnyRole('RECRUITER', 'ADMIN')")
    @GetMapping("/my-jobs")
    public ResponseEntity<CommonResponse> getMyJobs() {
        CommonResponse response = jobService.getMyJobs();
        return ResponseEntity.status(response.getCode()).body(response);
    }
}
