package com.project.ai_resumerag_be.dto.request;

import com.project.ai_resumerag_be.enums.AssessmentStatus;
import com.project.ai_resumerag_be.enums.AssessmentType;
import com.project.ai_resumerag_be.enums.QuestionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentRequest {

    public static final int MAX_QUESTIONS = 100;

    @NotBlank(message = "Title is required")
    @Size(min = 3, max = 200, message = "Title must be between 3 and 200 characters")
    private String title;

    @NotNull(message = "Type is required")
    private AssessmentType type;

    /** Defaults to ACTIVE on create and to the current status on update. */
    private AssessmentStatus status;

    /** Optional job this assessment belongs to. Null (or absent) means it is not tied to a job. */
    private UUID jobId;

    /** What the candidate reads about the test before starting. */
    @Size(max = 8000, message = "About the test must be at most 8000 characters")
    private String about;

    /** The candidate must accept these before starting. Blank means there is nothing to accept. */
    @Size(max = 20000, message = "Terms and conditions must be at most 20000 characters")
    private String termsAndConditions;

    /** Taken in order, each with its own time limit; the assessment's total time is their sum. */
    @NotEmpty(message = "At least one round is required")
    @Size(max = 10, message = "An assessment can have at most 10 rounds")
    @Valid
    private List<RoundRequest> rounds;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RoundRequest {

        @NotBlank(message = "Round title is required")
        @Size(max = 200, message = "Round title must be at most 200 characters")
        private String title;

        /** What the candidate is told about this round. */
        @Size(max = 4000, message = "Round description must be at most 4000 characters")
        private String description;

        @NotNull(message = "Round duration is required")
        @Min(value = 1, message = "Round duration must be at least 1 minute")
        @Max(value = 480, message = "Round duration must be at most 480 minutes")
        private Integer durationMinutes;

        @NotEmpty(message = "Each round needs at least one question")
        @Valid
        private List<QuestionRequest> questions;
    }

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
