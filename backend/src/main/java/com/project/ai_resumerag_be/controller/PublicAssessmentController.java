package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.StartAssessmentRequest;
import com.project.ai_resumerag_be.dto.request.SubmitAssessmentRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.enums.CommonResponseStatus;
import com.project.ai_resumerag_be.service.PublicAssessmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/** Unauthenticated: candidates open these through the secret token in their invite email. */
@RestController
@RequestMapping("/public/assessments")
@RequiredArgsConstructor
public class PublicAssessmentController {

    private final PublicAssessmentService publicAssessmentService;

    @GetMapping("/{token}")
    public ResponseEntity<CommonResponse> preview(@PathVariable String token) {
        return respond(publicAssessmentService.preview(token), "Assessment retrieved successfully");
    }

    @PostMapping("/{token}/start")
    public ResponseEntity<CommonResponse> start(@PathVariable String token, @RequestBody(required = false) StartAssessmentRequest request) {
        boolean acceptedTerms = request != null && request.isAcceptedTerms();
        return respond(publicAssessmentService.start(token, acceptedTerms), "Assessment started");
    }

    @PostMapping("/{token}/submit")
    public ResponseEntity<CommonResponse> submit(@PathVariable String token, @Valid @RequestBody SubmitAssessmentRequest request) {
        return respond(publicAssessmentService.submit(token, request), "Assessment submitted");
    }

    private ResponseEntity<CommonResponse> respond(Object data, String message) {
        return ResponseEntity.ok(CommonResponse.builder()
                .code(200)
                .status(CommonResponseStatus.SUCCESS)
                .data(data)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build());
    }
}
