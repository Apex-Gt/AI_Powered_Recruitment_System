package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
/** A resume to add. Name, email, phone and location are read from the resume itself. */
public class CandidateUploadRequest {

    @NotNull(message = "Job ID is required")
    private UUID jobId;

    @NotNull(message = "Resume file is required")
    private MultipartFile resumeFile;
}