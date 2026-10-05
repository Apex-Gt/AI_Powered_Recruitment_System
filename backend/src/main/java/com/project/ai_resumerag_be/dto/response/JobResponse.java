package com.project.ai_resumerag_be.dto.response;

import com.project.ai_resumerag_be.enumerators.EmploymentType;
import com.project.ai_resumerag_be.enumerators.JobStatus;
import com.project.ai_resumerag_be.enumerators.SkillType;
import com.project.ai_resumerag_be.enumerators.WorkMode;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobResponse {

    private UUID id;

    private String title;
    private String department;

    private EmploymentType employmentType;
    private WorkMode workMode;

    private String location;

    private Integer experienceRequired;

    private String educationRequired;

    private BigDecimal minimumSalary;
    private BigDecimal maximumSalary;

    private String description;

    private String jdFilePath;

    private JobStatus status;

    private LocalDate applicationDeadline;

    private Integer vacancies;

    private List<SkillInfo> skills;

    private CompanyInfo company;
    private UserInfo createdBy;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CompanyInfo {
        private UUID id;
        private String companyName;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserInfo {
        private UUID id;
        private String userName;
        private String email;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SkillInfo {
        private UUID skillId;
        private String skillName;
        private String skillCategory;
        private SkillType type;
        private BigDecimal weight;
    }
}