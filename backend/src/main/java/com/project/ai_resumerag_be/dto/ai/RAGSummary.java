package com.project.ai_resumerag_be.dto.ai;

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
public class RAGSummary {

    private UUID candidateId;
    private UUID jobId;
    private List<String> strengths;
    private List<String> matchedSkills;
    private List<String> missingSkills;
    private List<String> relevantExperience;
    private List<EvidenceChunk> evidence;
    private String summaryText;
    private Double confidenceScore;
    private String modelUsed;
    private String promptVersion;
}