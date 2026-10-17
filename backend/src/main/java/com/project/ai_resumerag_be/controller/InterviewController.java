package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.InterviewFeedbackRequest;
import com.project.ai_resumerag_be.dto.request.InterviewRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.InterviewResponse;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
import com.project.ai_resumerag_be.enumerators.InterviewStatus;
import com.project.ai_resumerag_be.service.InterviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/interviews")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
public class InterviewController {

    private final InterviewService interviewService;

    @GetMapping
    public ResponseEntity<CommonResponse> list(
            @RequestParam(required = false) InterviewStatus status,
            @RequestParam(required = false) UUID candidateId,
            @RequestParam(required = false) UUID jobId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        List<InterviewResponse> all = interviewService.list(status, candidateId, jobId);

        int size = Math.max(1, pageSize);
        int total = all.size();
        int from = Math.min(Math.max(0, (page - 1) * size), total);
        int to = Math.min(from + size, total);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("data", all.subList(from, to));
        data.put("total", total);
        data.put("page", page);
        data.put("pageSize", size);
        data.put("totalPages", (int) Math.ceil((double) total / size));
        return ok(data, "Interviews retrieved successfully", 200);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommonResponse> get(@PathVariable UUID id) {
        return ok(interviewService.get(id), "Interview retrieved successfully", 200);
    }

    @PostMapping
    public ResponseEntity<CommonResponse> schedule(@Valid @RequestBody InterviewRequest request) {
        return ok(interviewService.schedule(request), "Interview scheduled successfully", 201);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CommonResponse> update(@PathVariable UUID id, @Valid @RequestBody InterviewRequest request) {
        return ok(interviewService.update(id, request), "Interview updated successfully", 200);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<CommonResponse> cancel(@PathVariable UUID id) {
        return ok(interviewService.cancel(id), "Interview cancelled", 200);
    }

    @PostMapping("/{id}/feedback")
    public ResponseEntity<CommonResponse> feedback(@PathVariable UUID id, @Valid @RequestBody InterviewFeedbackRequest request) {
        return ok(interviewService.submitFeedback(id, request), "Feedback submitted successfully", 200);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<CommonResponse> delete(@PathVariable UUID id) {
        interviewService.delete(id);
        return ok(null, "Interview deleted successfully", 200);
    }

    private ResponseEntity<CommonResponse> ok(Object data, String message, int code) {
        return ResponseEntity.status(code).body(CommonResponse.builder()
                .code(code)
                .status(CommonResponseStatus.SUCCESS)
                .data(data)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build());
    }
}
