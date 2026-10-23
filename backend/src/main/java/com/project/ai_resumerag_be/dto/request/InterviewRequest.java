package com.project.ai_resumerag_be.dto.request;

import com.project.ai_resumerag_be.enums.InterviewType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewRequest {

    @NotNull(message = "Candidate is required")
    private UUID candidateId;

    /** Optional: the interview always belongs to the candidate's job; if sent, it must match. */
    private UUID jobId;

    @NotNull(message = "Interview type is required")
    private InterviewType type;

    @NotNull(message = "Scheduled time is required")
    private LocalDateTime scheduledAt;

    @NotNull(message = "Duration is required")
    @Min(value = 15, message = "Duration must be at least 15 minutes")
    @Max(value = 480, message = "Duration must be at most 480 minutes")
    private Integer duration;

    @NotEmpty(message = "At least one interviewer is required")
    private List<@Size(max = 150) String> interviewers;

    @Size(max = 500)
    private String meetingLink;
}
