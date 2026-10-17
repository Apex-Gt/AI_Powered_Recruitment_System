package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateUpdateRequest {

    @NotBlank(message = "Candidate name is required")
    @Size(max = 150)
    private String candidateName;

    @NotBlank(message = "Candidate email is required")
    @Email(message = "Candidate email must be valid")
    @Size(max = 150)
    private String candidateEmail;

    @Size(max = 30)
    private String phoneNumber;

    @Size(max = 150)
    private String location;
}
