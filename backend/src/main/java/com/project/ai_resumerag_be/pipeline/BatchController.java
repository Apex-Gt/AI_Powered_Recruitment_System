package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.enums.CommonResponseStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bulk resume processing. {@code POST /recruiter/batches} answers 202 with a batch id as soon as the files are
 * stored and queued; the other endpoints are polled for progress, results and retries.
 */
@RestController
@RequestMapping("/recruiter/batches")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECRUITER','ADMIN')")
public class BatchController {

    private final BatchService batchService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CommonResponse> create(@RequestParam("jobId") UUID jobId, @RequestParam("files") List<MultipartFile> files) {
        ResumeBatch batch = batchService.createBatch(jobId, files);
        return respond(202, batchService.progress(batch.getId()),
                "Batch accepted. Resumes are being processed in the background; poll the batch for progress.");
    }

    @GetMapping("/{batchId}")
    public ResponseEntity<CommonResponse> progress(@PathVariable UUID batchId) {
        return respond(200, batchService.progress(batchId), "Batch progress");
    }

    @GetMapping("/{batchId}/tasks")
    public ResponseEntity<CommonResponse> tasks(
            @PathVariable UUID batchId,
            @RequestParam(required = false) ResumeTaskStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = batchService.listTasks(batchId, status, page, size);
        return respond(200, Map.of("items", result.getContent(), "page", result.getNumber(), "totalPages", result.getTotalPages(),
                "totalItems", result.getTotalElements()), "Resumes in this batch");
    }

    @GetMapping("/{batchId}/results")
    public ResponseEntity<CommonResponse> results(@PathVariable UUID batchId) {
        return respond(200, batchService.results(batchId), "Completed candidate analyses, best match first");
    }

    @PostMapping("/{batchId}/retry")
    public ResponseEntity<CommonResponse> retryFailed(@PathVariable UUID batchId) {
        int requeued = batchService.retryFailed(batchId);
        return respond(200, Map.of("requeued", requeued), requeued + " failed resume(s) queued again");
    }

    @PostMapping("/{batchId}/tasks/{taskId}/retry")
    public ResponseEntity<CommonResponse> retryTask(@PathVariable UUID batchId, @PathVariable UUID taskId) {
        boolean requeued = batchService.retryTask(batchId, taskId);
        return respond(requeued ? 200 : 409, Map.of("requeued", requeued),
                requeued ? "Resume queued again" : "Only failed resumes with a stored file can be retried");
    }

    @GetMapping
    public ResponseEntity<CommonResponse> forJob(@RequestParam UUID jobId) {
        return respond(200, batchService.recentForJob(jobId), "Recent batches for this job");
    }

    private ResponseEntity<CommonResponse> respond(int code, Object data, String message) {
        return ResponseEntity.status(code).body(CommonResponse.builder()
                .code(code)
                .status(code < 400 ? CommonResponseStatus.SUCCESS : CommonResponseStatus.FAILURE)
                .data(data)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build());
    }
}
