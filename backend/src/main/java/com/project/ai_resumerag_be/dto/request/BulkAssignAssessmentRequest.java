package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BulkAssignAssessmentRequest {

    @NotEmpty(message = "Select at least one candidate")
    @Size(max = 500, message = "You can send an assessment to at most 500 candidates at once")
    private List<UUID> candidateIds;
}
