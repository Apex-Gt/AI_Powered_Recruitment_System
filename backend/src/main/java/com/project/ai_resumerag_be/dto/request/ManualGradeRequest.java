package com.project.ai_resumerag_be.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ManualGradeRequest {

    @NotNull(message = "Score is required")
    @DecimalMin("0")
    @DecimalMax("100")
    private Double score;

    @Size(max = 4000)
    private String feedback;
}
