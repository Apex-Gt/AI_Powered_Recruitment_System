package com.project.ai_resumerag_be.dto.request;

import com.project.ai_resumerag_be.enumerators.EmploymentType;
import com.project.ai_resumerag_be.enumerators.WorkMode;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobRequest {

    @NotBlank(message = "Job title is required")
    @Size(max = 150)
    private String title;

    @NotBlank(message = "Department is required")
    @Size(max = 100)
    private String department;

    @NotNull(message = "Employment type is required")
    private EmploymentType employmentType;

    @NotNull(message = "Work mode is required")
    private WorkMode workMode;

    @NotBlank(message = "Location is required")
    @Size(max = 150)
    private String location;

    @NotNull(message = "Minimum experience is required")
    @Min(0)
    private Integer experienceRequired;

    @NotBlank(message = "Education requirement is required")
    @Size(max = 100)
    private String educationRequired;

    @DecimalMin(value = "0.0")
    private BigDecimal minimumSalary;

    @DecimalMin(value = "0.0")
    private BigDecimal maximumSalary;

    @Size(max = 10)
    private String salaryCurrency;

    @NotBlank(message = "Job description is required")
    private String description;

    @FutureOrPresent(message = "Application deadline must be today or in the future")
    private LocalDate applicationDeadline;

    @Positive(message = "Vacancies must be greater than zero")
    private Integer vacancies;

    @NotEmpty(message = "At least one skill is required")
    private List<JobSkillRequest> skills;
}
