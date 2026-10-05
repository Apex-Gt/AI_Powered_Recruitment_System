package com.project.ai_resumerag_be.dto.request;

import com.project.ai_resumerag_be.enumerators.SkillType;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobSkillRequest {

    private UUID skillId;

    @Size(max = 100)
    private String skillName;

    @Size(max = 100)
    private String skillCategory;

    @NotNull(message = "Skill type is required")
    private SkillType type;

    @NotNull(message = "Weight is required")
    @DecimalMin(value = "0.0")
    @DecimalMax(value = "100.0")
    private BigDecimal weight;
}