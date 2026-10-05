package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.enumerators.Role;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    private UUID id;
    private String userName;
    private String email;
    private String phoneNumber;
    private Boolean emailVerified;
    private Boolean phoneNumberVerified;
    private Role role;
    private Company company;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
