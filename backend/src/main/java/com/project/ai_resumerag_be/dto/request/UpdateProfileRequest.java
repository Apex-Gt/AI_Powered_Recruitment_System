package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UpdateProfileRequest {
    @NotBlank
    @Size(max = 100)
    private String userName;

    @Email
    @NotBlank
    private String email;

    @Size(max = 20)
    private String phoneNumber;
}