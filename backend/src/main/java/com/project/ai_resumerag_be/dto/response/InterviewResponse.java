package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enums.InterviewRecommendation;
import com.project.ai_resumerag_be.enums.InterviewStatus;
import com.project.ai_resumerag_be.enums.InterviewType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
public class InterviewResponse {
    private UUID id;
    private UUID candidateId;
    private String candidateName;
    private UUID jobId;
    private String jobTitle;
    private InterviewType type;
    private LocalDateTime scheduledAt;
    private Integer duration;
    private List<String> interviewers;
    private InterviewStatus status;
    private String meetingLink;
    private Feedback feedback;

    @Getter
    @Builder
    public static class Feedback {
        private Integer rating;
        private List<String> strengths;
        private List<String> weaknesses;
        private InterviewRecommendation recommendation;
        private String notes;
        private LocalDateTime submittedAt;
        private String submittedBy;
    }
}
