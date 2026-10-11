package com.project.ai_resumerag_be.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIServiceResponse<T> {

    private String status;
    private String message;
    private T data;
}