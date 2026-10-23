package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.request.InterviewFeedbackRequest;
import com.project.ai_resumerag_be.dto.request.InterviewRequest;
import com.project.ai_resumerag_be.dto.response.InterviewResponse;
import com.project.ai_resumerag_be.enums.InterviewStatus;

import java.util.List;
import java.util.UUID;

public interface InterviewService {

    /** Interviews of the authenticated user's company, newest first, optionally filtered. */
    List<InterviewResponse> list(InterviewStatus status, UUID candidateId, UUID jobId);

    InterviewResponse get(UUID interviewId);

    InterviewResponse schedule(InterviewRequest request);

    InterviewResponse update(UUID interviewId, InterviewRequest request);

    InterviewResponse cancel(UUID interviewId);

    InterviewResponse submitFeedback(UUID interviewId, InterviewFeedbackRequest request);

    void delete(UUID interviewId);
}
