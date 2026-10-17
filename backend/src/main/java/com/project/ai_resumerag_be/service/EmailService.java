package com.project.ai_resumerag_be.service;

import java.time.LocalDateTime;

public interface EmailService {
    void sendRecruiterCredentials(String toEmail, String userName, String password, String loginUrl, String companyName);

    /**
     * Tells a candidate about an interview.
     *
     * @param kind "scheduled", "rescheduled" or "cancelled"
     */
    void sendInterviewNotice(String toEmail, String candidateName, String jobTitle, String companyName, String kind,
                             String interviewType, LocalDateTime scheduledAt, int durationMinutes, String meetingLink);

    /** Sends the candidate the secret link to take an assessment. */
    void sendAssessmentInvite(String toEmail, String candidateName, String assessmentTitle, String companyName,
                              String link, int durationMinutes, LocalDateTime expiresAt);
}
