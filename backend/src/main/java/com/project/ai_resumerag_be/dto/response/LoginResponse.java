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
public class LoginResponse {

    private String accessToken;
    private String tokenType;
    private Long expiresIn;
    private UserInfo user;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserInfo {
        private UUID id;
        private String userName;
        private String email;
        private String phoneNumber;
        private Boolean emailVerified;
        private Boolean phoneNumberVerified;
        private Role role;
        private UUID companyId;
        private String companyName;
        private Boolean active;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}