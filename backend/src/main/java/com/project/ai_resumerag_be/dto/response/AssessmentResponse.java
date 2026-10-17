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
    private Integer duration;
    private AssessmentStatus status;
    private LocalDateTime createdAt;
    private List<Question> questions;

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
