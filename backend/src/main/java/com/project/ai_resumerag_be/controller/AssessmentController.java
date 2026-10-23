package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.AssessmentRequest;
import com.project.ai_resumerag_be.dto.request.AssignAssessmentRequest;
import com.project.ai_resumerag_be.dto.request.BulkAssignAssessmentRequest;
import com.project.ai_resumerag_be.dto.request.ManualGradeRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.enums.CommonResponseStatus;
import com.project.ai_resumerag_be.service.AssessmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/assessments")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
public class AssessmentController {

    private final AssessmentService assessmentService;

    @GetMapping
    public ResponseEntity<CommonResponse> list(@RequestParam(required = false) UUID jobId) {
        return respond(assessmentService.list(jobId), "Assessments retrieved successfully", 200);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommonResponse> get(@PathVariable UUID id) {
        return respond(assessmentService.get(id), "Assessment retrieved successfully", 200);
    }

    @PostMapping
    public ResponseEntity<CommonResponse> create(@Valid @RequestBody AssessmentRequest request) {
        return respond(assessmentService.create(request), "Assessment created successfully", 201);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CommonResponse> update(@PathVariable UUID id, @Valid @RequestBody AssessmentRequest request) {
        return respond(assessmentService.update(id, request), "Assessment updated successfully", 200);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<CommonResponse> delete(@PathVariable UUID id) {
        assessmentService.delete(id);
        return respond(null, "Assessment deleted successfully", 200);
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<CommonResponse> assign(@PathVariable UUID id, @Valid @RequestBody AssignAssessmentRequest request) {
        return respond(assessmentService.assign(id, request.getCandidateId()), "Assessment sent to candidate", 201);
    }

    @PostMapping("/{id}/assign-many")
    public ResponseEntity<CommonResponse> assignMany(@PathVariable UUID id, @Valid @RequestBody BulkAssignAssessmentRequest request) {
        return respond(assessmentService.assignMany(id, request.getCandidateIds()), "Assessment sent", 201);
    }

    @GetMapping("/attempts")
    public ResponseEntity<CommonResponse> attempts(
            @RequestParam(required = false) UUID assessmentId,
            @RequestParam(required = false) UUID candidateId) {
        return respond(assessmentService.listAttempts(assessmentId, candidateId), "Attempts retrieved successfully", 200);
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<CommonResponse> attempt(@PathVariable UUID attemptId) {
        return respond(assessmentService.getAttempt(attemptId), "Attempt retrieved successfully", 200);
    }

    @PutMapping("/attempts/{attemptId}/answers/{answerId}/grade")
    public ResponseEntity<CommonResponse> grade(
            @PathVariable UUID attemptId,
            @PathVariable UUID answerId,
            @Valid @RequestBody ManualGradeRequest request) {
        return respond(assessmentService.gradeAnswer(attemptId, answerId, request), "Answer graded", 200);
    }

    private ResponseEntity<CommonResponse> respond(Object data, String message, int code) {
        return ResponseEntity.status(code).body(CommonResponse.builder()
                .code(code)
                .status(CommonResponseStatus.SUCCESS)
                .data(data)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build());
    }
}
