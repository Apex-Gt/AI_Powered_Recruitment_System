package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Result of grading one free-form answer in the AI service. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GradeResult {
    private double score;
    private String feedback;
}
