package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enumerators.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Builder
@AllArgsConstructor
@NoArgsConstructor
@Data
public class SignUpResponse {
    private UUID id;
    private String userName;
    private String email;
    private String phoneNumber;
    private Role role;
    private Boolean isEmailVerified;
    private Boolean isPhoneNumberVerified;
}
