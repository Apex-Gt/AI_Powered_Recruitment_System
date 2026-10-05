package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enumerators.Role;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompanyRegistrationResponse {

    private CompanyInfo company;
    private AdminInfo admin;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CompanyInfo {
        private UUID id;
        private String companyName;
        private String country;
        private String state;
        private String city;
        private String gstNumber;
        private Boolean companyVerified;
        private Boolean active;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AdminInfo {
        private UUID id;
        private String userName;
        private String email;
        private String phoneNumber;
        private Boolean emailVerified;
        private Boolean phoneNumberVerified;
        private Role role;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}