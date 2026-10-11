package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RankedCandidate {

    private UUID candidateId;
    private UUID jobId;
    private Integer rank;
    private Double overallScore;
    private MatchScore matchScore;
    private RAGSummary ragSummary;
}