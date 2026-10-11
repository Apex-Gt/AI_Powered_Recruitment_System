package com.project.ai_resumerag_be.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private UUID resumeId;
}