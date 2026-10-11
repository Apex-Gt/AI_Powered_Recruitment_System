package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobDescription {

    private String jobId;
    private String title;
    private String companyId;
    private String description;
    private List<JobRequirement> requirements;
    private List<String> requiredSkills;
    private List<String> preferredSkills;
    private Double minExperienceYears;
    private String educationLevel;
    private String location;
    private String employmentType;
}