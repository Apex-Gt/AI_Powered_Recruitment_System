package com.project.ai_resumerag_be.dto.request;

import com.project.ai_resumerag_be.enumerators.InterviewRecommendation;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewFeedbackRequest {

    @NotNull(message = "Rating is required")
    @Min(1)
    @Max(5)
    private Integer rating;

    private List<String> strengths;

    private List<String> weaknesses;

    @NotNull(message = "Recommendation is required")
    private InterviewRecommendation recommendation;

    private String notes;
}
