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
public class RankingResult {

    private UUID jobId;
    private List<RankedCandidate> candidates;
    private Integer totalCandidates;
    private String scoringVersion;
}