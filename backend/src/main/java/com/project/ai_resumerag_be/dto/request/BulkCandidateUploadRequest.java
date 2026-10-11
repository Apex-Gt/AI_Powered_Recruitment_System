package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkCandidateUploadRequest {

    @NotNull(message = "Job ID is required")
    private UUID jobId;

    @NotEmpty(message = "At least one candidate is required")
    @Valid
    private List<CandidateUploadRequest> candidates;
}