package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.NotBlank;
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
public class CandidateUploadRequest {

    @NotBlank(message = "Candidate name is required")
    private String candidateName;

    @NotBlank(message = "Candidate email is required")
    private String candidateEmail;

    private String phoneNumber;

    private String location;

    @NotNull(message = "Job ID is required")
    private UUID jobId;

    @NotNull(message = "Resume file is required")
    private MultipartFile resumeFile;
}