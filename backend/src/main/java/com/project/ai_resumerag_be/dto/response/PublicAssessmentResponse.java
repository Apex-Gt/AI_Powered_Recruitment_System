package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enumerators.AttemptStatus;
import com.project.ai_resumerag_be.enumerators.QuestionType;
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
    private Integer duration;
    private AttemptStatus status;
    private int questionCount;
    private LocalDateTime expiresAt;
    /** Time left to submit, in seconds, measured by the server clock; only set while in progress. */
    private Long secondsLeft;
    /** Only filled after the attempt was started, and only while it is in progress. */
    private List<Question> questions;

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
