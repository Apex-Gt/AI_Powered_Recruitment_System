package com.project.ai_resumerag_be.dto.request;

import com.project.ai_resumerag_be.enumerators.AssessmentStatus;
import com.project.ai_resumerag_be.enumerators.AssessmentType;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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
public class AssessmentRequest {

    @NotBlank(message = "Title is required")
    @Size(min = 3, max = 200, message = "Title must be between 3 and 200 characters")
    private String title;

    @NotNull(message = "Type is required")
    private AssessmentType type;

    @NotNull(message = "Duration is required")
    @Min(value = 1, message = "Duration must be at least 1 minute")
    @Max(value = 480, message = "Duration must be at most 480 minutes")
    private Integer duration;

    /** Defaults to ACTIVE on create and to the current status on update. */
    private AssessmentStatus status;

    @NotEmpty(message = "At least one question is required")
    @Size(max = 100, message = "An assessment can have at most 100 questions")
    @Valid
    private List<QuestionRequest> questions;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class QuestionRequest {

        @NotBlank(message = "Question text is required")
        @Size(max = 8000)
        private String question;

        @NotNull(message = "Question type is required")
        private QuestionType type;

        private List<@Size(max = 1000) String> options;

        @Size(max = 1000)
        private String correctAnswer;

        @NotNull
        @Min(1)
        @Max(100)
        private Integer weight;
    }
}
