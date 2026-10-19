package com.project.ai_resumerag_be.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
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
public class IngestResumeEvent {

    private UUID candidateId;
    private UUID resumeId;
    private UUID jobId;
    private String pdfPath;
    private String sourcePdf;
    private java.util.Map<String, Object> profile;
}