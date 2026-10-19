package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enumerators.AssessmentStatus;
import com.project.ai_resumerag_be.enumerators.AssessmentType;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Recruiter view of an assessment, including correct answers. */
@Getter
@Builder
public class AssessmentResponse {
    private UUID id;
    private String title;
    private AssessmentType type;
    /** Total minutes: the sum of the round time limits. */
    private Integer duration;
    private AssessmentStatus status;
    /** Null when the assessment is not tied to a job. */
    private UUID jobId;
    private String jobTitle;
    private String about;
    private String termsAndConditions;
    private LocalDateTime createdAt;
    private List<Round> rounds;
    /** Every question across all rounds, in order. */
    private List<Question> questions;

    @Getter
    @Builder
    public static class Round {
        /** Null for an assessment from before rounds existed, which reads as one implicit round. */
        private UUID id;
        private String title;
        private String description;
        private Integer durationMinutes;
        private List<Question> questions;
    }

    @Getter
    @Builder
    public static class Question {
        private UUID id;
        private String question;
        private QuestionType type;
        private List<String> options;
        private String correctAnswer;
        private Integer weight;
    }
}
