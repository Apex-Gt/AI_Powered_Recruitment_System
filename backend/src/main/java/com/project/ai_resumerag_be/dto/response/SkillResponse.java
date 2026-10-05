package com.project.ai_resumerag_be.dto.response;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SkillResponse {

    private UUID id;
    private String name;
    private String category;
}