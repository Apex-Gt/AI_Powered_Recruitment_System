package com.project.ai_resumerag_be.dto.request;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StartAssessmentRequest {

    /** The candidate ticked "I accept the terms and conditions". Only needed the first time they start. */
    private boolean acceptedTerms;
}
