package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvidenceChunk {

    private String chunkId;
    private String text;
    private String section;
    private Double relevanceScore;
    private String sourcePdf;
}