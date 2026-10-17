package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SubmitAssessmentRequest {

    /** Question id to the candidate's answer (the chosen option text, code, essay text or video link). */
    @NotNull(message = "Answers are required")
    private Map<String, String> answers;
}
