package com.project.ai_resumerag_be.service.implementation;

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