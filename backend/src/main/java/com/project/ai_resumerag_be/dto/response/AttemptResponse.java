package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enumerators.AttemptStatus;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Recruiter view of an assigned assessment and its results. {@code answers} is only filled in the detail view. */
@Getter
@Builder
public class AttemptResponse {
    private UUID id;
    private UUID assessmentId;
    private String assessmentTitle;
    private UUID candidateId;
    private String candidateName;
    private AttemptStatus status;
    private Double totalScore;
    private LocalDateTime assignedAt;
    private LocalDateTime expiresAt;
    private LocalDateTime startedAt;
    private LocalDateTime submittedAt;
    private int pendingReview;
    private List<Answer> answers;
    /** Only returned when the assessment is assigned, so the recruiter can share it if email is not configured. */
    private String link;

    @Getter
    @Builder
    public static class Answer {
        private UUID id;
        private UUID questionId;
        private String question;
        private QuestionType type;
        private Integer weight;
        private String answer;
        private String correctAnswer;
        private Double score;
        private String feedback;
        private boolean needsReview;
    }
}
