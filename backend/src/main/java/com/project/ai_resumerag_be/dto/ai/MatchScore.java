package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchScore {

    private UUID candidateId;
    private UUID jobId;
    private Double overallScore;
    private Double skillMatchScore;
    private Double experienceMatchScore;
    private Double educationMatchScore;
    private Double semanticMatchScore;
    private List<String> matchedSkills;
    private List<String> missingSkills;
    private Double skillCoverage;
    private List<String> evidenceChunks;
    private Map<String, Object> metadata;
}