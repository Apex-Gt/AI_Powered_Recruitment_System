package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobRequirement {

    private String skill;
    private Boolean required;
    private Double minYearsExperience;
    private Double weight;
}