package com.project.ai_resumerag_be.service;

public interface EmailService {
    void sendRecruiterCredentials(String toEmail, String userName, String password, String loginUrl, String companyName);
}