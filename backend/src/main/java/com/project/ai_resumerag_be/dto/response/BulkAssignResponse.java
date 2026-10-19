package com.project.ai_resumerag_be.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

/** Outcome of sending one assessment to many candidates: who got it, and who was skipped and why. */
@Getter
@Builder
public class BulkAssignResponse {
    /** Each carries the personal link, in case email is not configured. */
    private List<AttemptResponse> sent;
    private List<Skipped> skipped;

    @Getter
    @Builder
    public static class Skipped {
        private UUID candidateId;
        private String candidateName;
        private String reason;
    }
}
