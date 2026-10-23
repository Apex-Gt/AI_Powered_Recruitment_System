package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enums.AttemptStatus;
import com.project.ai_resumerag_be.enums.QuestionType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** What a candidate sees through their link. Never contains correct answers. */
@Getter
@Builder
public class PublicAssessmentResponse {
    private String title;
    private String companyName;
    private String candidateName;
    /** Total minutes across all rounds. */
    private Integer duration;
    private AttemptStatus status;
    private int questionCount;
    private LocalDateTime expiresAt;
    private String about;
    private String termsAndConditions;
    /** The whole structure up front, so the candidate knows what is coming. No questions in here. */
    private List<Round> rounds;
    /** Zero-based index of the round the candidate is on; only set while the attempt is in progress. */
    private Integer currentRound;
    /** True while the current round's clock is running; false when the candidate still has to start it. */
    private Boolean roundRunning;
    /** Time left in the current round, in seconds, measured by the server clock; only set while it is running. */
    private Long secondsLeft;
    /** Only the current round's questions, and only while that round is running. */
    private List<Question> questions;

    @Getter
    @Builder
    public static class Round {
        private String title;
        private String description;
        private Integer durationMinutes;
        private int questionCount;
    }

    @Getter
    @Builder
    public static class Question {
        private UUID id;
        private String question;
        private QuestionType type;
        private List<String> options;
        private Integer weight;
    }
}
