package com.project.ai_resumerag_be.service.impl;

import com.project.ai_resumerag_be.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImplementation implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String mailUsername;

    @Value("${spring.mail.password}")
    private String mailPassword;

    @Async
    @Override
    public void sendRecruiterCredentials(String toEmail, String userName, String password, String loginUrl, String companyName) {
        if (!isMailConfigured()) {
            log.warn("Email not configured. Skipping credentials email to: {}. Set MAIL_USERNAME and MAIL_PASSWORD env vars.", toEmail);
            log.warn("For Gmail: Use an App Password (not regular password). Enable 2FA then generate at: https://myaccount.google.com/apppasswords");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Your Recruiter Account Credentials");

            String htmlContent = buildCredentialsEmail(toEmail, userName, password, loginUrl, companyName);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Credentials email sent to: {}", toEmail);
        } catch (MailAuthenticationException e) {
            log.error("Email authentication failed. Check MAIL_USERNAME and MAIL_PASSWORD. For Gmail, use App Password: https://myaccount.google.com/apppasswords", e);
        } catch (MailSendException e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage(), e);
        } catch (MessagingException e) {
            log.error("Failed to build email for {}: {}", toEmail, e.getMessage(), e);
        }
    }

    @Async
    @Override
    public void sendInterviewNotice(String toEmail, String candidateName, String jobTitle, String companyName, String kind,
                                    String interviewType, LocalDateTime scheduledAt, int durationMinutes, String meetingLink) {
        if (!isMailConfigured()) {
            log.warn("Email not configured. Skipping interview {} email to: {}", kind, toEmail);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Interview " + kind + " - " + jobTitle + " at " + companyName);
            helper.setText(buildInterviewEmail(candidateName, jobTitle, companyName, kind, interviewType, scheduledAt, durationMinutes, meetingLink), true);
            mailSender.send(message);
            log.info("Interview {} email sent to: {}", kind, toEmail);
        } catch (MailAuthenticationException e) {
            log.error("Email authentication failed. Check MAIL_USERNAME and MAIL_PASSWORD.", e);
        } catch (MailSendException | MessagingException e) {
            log.error("Failed to send interview email to {}: {}", toEmail, e.getMessage(), e);
        }
    }

    private String buildInterviewEmail(String candidateName, String jobTitle, String companyName, String kind,
                                       String interviewType, LocalDateTime scheduledAt, int durationMinutes, String meetingLink) {
        String intro = switch (kind) {
            case "cancelled" -> "Your interview for <strong>%s</strong> at <strong>%s</strong> has been cancelled. We will be in touch if it is rebooked.";
            case "rescheduled" -> "Your interview for <strong>%s</strong> at <strong>%s</strong> has been rescheduled. The new details are below.";
            default -> "You have been invited to an interview for <strong>%s</strong> at <strong>%s</strong>.";
        };
        String details = "cancelled".equals(kind) ? "" : """
                <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 4px 0;"><strong>When:</strong> %s</p>
                    <p style="margin: 4px 0;"><strong>Duration:</strong> %d minutes</p>
                    <p style="margin: 4px 0;"><strong>Type:</strong> %s</p>
                    %s
                </div>
                """.formatted(
                scheduledAt.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy 'at' HH:mm")),
                durationMinutes,
                HtmlUtils.htmlEscape(interviewType),
                meetingLink == null || meetingLink.isBlank() ? ""
                        : "<p style=\"margin: 4px 0;\"><strong>Link:</strong> " + HtmlUtils.htmlEscape(meetingLink) + "</p>");
        return """
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
                        <p>Hi <strong>%s</strong>,</p>
                        <p>%s</p>
                        %s
                        <p style="color: #6c757d; font-size: 13px;">%s</p>
                    </div>
                </body>
                </html>
                """.formatted(
                HtmlUtils.htmlEscape(candidateName),
                intro.formatted(HtmlUtils.htmlEscape(jobTitle), HtmlUtils.htmlEscape(companyName)),
                details,
                HtmlUtils.htmlEscape(companyName));
    }

    @Async
    @Override
    public void sendAssessmentInvite(String toEmail, String candidateName, String assessmentTitle, String companyName,
                                     String link, int durationMinutes, LocalDateTime expiresAt) {
        if (!isMailConfigured()) {
            log.warn("Email not configured. Skipping assessment invite to: {}", toEmail);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Assessment from " + companyName + ": " + assessmentTitle);
            helper.setText("""
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
                            <p>Hi <strong>%s</strong>,</p>
                            <p><strong>%s</strong> has invited you to complete the assessment <strong>%s</strong>.</p>
                            <p>You will have <strong>%d minutes</strong> once you start, and the link works until
                            <strong>%s</strong>. You can only start once, so pick a quiet moment.</p>
                            <p style="margin: 24px 0;"><a href="%s" style="background: #6d4aff; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none;">Open assessment</a></p>
                            <p style="color: #6c757d; font-size: 13px;">Or copy this link: %s<br>This link is personal. Please do not share it.</p>
                        </div>
                    </body>
                    </html>
                    """.formatted(
                    HtmlUtils.htmlEscape(candidateName),
                    HtmlUtils.htmlEscape(companyName),
                    HtmlUtils.htmlEscape(assessmentTitle),
                    durationMinutes,
                    expiresAt.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy 'at' HH:mm")),
                    HtmlUtils.htmlEscape(link),
                    HtmlUtils.htmlEscape(link)), true);
            mailSender.send(message);
            log.info("Assessment invite sent to: {}", toEmail);
        } catch (MailAuthenticationException e) {
            log.error("Email authentication failed. Check MAIL_USERNAME and MAIL_PASSWORD.", e);
        } catch (MailSendException | MessagingException e) {
            log.error("Failed to send assessment invite to {}: {}", toEmail, e.getMessage(), e);
        }
    }

    private boolean isMailConfigured() {
        return mailUsername != null && !mailUsername.isBlank()
                && mailPassword != null && !mailPassword.isBlank();
    }

    private String buildCredentialsEmail(String toEmail, String userName, String password, String loginUrl, String companyName) {
        return """
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
                        <h2 style="color: #2c3e50; margin-bottom: 20px;">Welcome to %s</h2>
                        
                        <p>Hi <strong>%s</strong>,</p>
                        
                        <p>An administrator has created a recruiter account for you at <strong>%s</strong>. Here are your login credentials:</p>
                        
                        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
                            <table style="width: 100%%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold; color: #6c757d; width: 30%%;">Email:</td>
                                    <td style="padding: 8px 0; font-family: monospace; background: #f8f9fa; border-radius: 4px; padding-left: 10px;">%s</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold; color: #6c757d;">Password:</td>
                                    <td style="padding: 8px 0; font-family: monospace; background: #f8f9fa; border-radius: 4px; padding-left: 10px;">%s</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p><strong>Important:</strong> For security, please log in and change your password immediately.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="%s" style="background: #2c3e50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                        
                        <p style="font-size: 12px; color: #6c757d;">This is an automated message from %s. Please do not reply to this email.</p>
                    </div>
                </body>
                </html>
                """.formatted(companyName, userName, companyName, toEmail, password, loginUrl, companyName);
    }
}