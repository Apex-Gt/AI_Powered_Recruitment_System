package com.project.ai_resumerag_be.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateResponse {

    private UUID id;
    private String candidateName;
    private String candidateEmail;
    private String phoneNumber;
    private String location;
    private String status;
    private UUID jobId;
    private String jobTitle;
    private UUID resumeId;
    private String resumeFileName;
    private Double aiMatchScore;
    private Integer experience;
    private List<String> skills;
    private LocalDateTime appliedAt;
}
