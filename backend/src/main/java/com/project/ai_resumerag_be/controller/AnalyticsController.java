package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.enums.CommonResponseStatus;
import com.project.ai_resumerag_be.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/overview")
    public ResponseEntity<CommonResponse> overview() {
        return ok(analyticsService.overview());
    }

    @GetMapping("/funnel")
    public ResponseEntity<CommonResponse> funnel() {
        return ok(analyticsService.funnel());
    }

    @GetMapping("/time-to-hire")
    public ResponseEntity<CommonResponse> timeToHire() {
        return ok(analyticsService.timeToHire());
    }

    @GetMapping("/ai-match-distribution")
    public ResponseEntity<CommonResponse> aiMatchDistribution() {
        return ok(analyticsService.aiMatchDistribution());
    }

    @GetMapping("/jobs")
    public ResponseEntity<CommonResponse> jobsMetrics() {
        return ok(analyticsService.jobsMetrics());
    }

    private ResponseEntity<CommonResponse> ok(Object data) {
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(data)
                .message("Analytics retrieved successfully")
                .timestamp(LocalDateTime.now())
                .build());
    }
}
