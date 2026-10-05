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
public class CompanyResponse {

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

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecruiterSummary {
        private UUID id;
        private String userName;
        private String email;
        private String phoneNumber;
        private Role role;
        private Boolean active;
        private LocalDateTime createdAt;
    }
}