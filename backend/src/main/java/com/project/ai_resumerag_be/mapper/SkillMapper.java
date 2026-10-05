package com.project.ai_resumerag_be.mapper;

import com.project.ai_resumerag_be.dto.response.SkillResponse;
import com.project.ai_resumerag_be.entity.Skill;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SkillMapper {

    @Mapping(target = "id", source = "skill.id")
    @Mapping(target = "name", source = "skill.name")
    @Mapping(target = "category", source = "skill.category")
    SkillResponse toSkillResponse(Skill skill);
}