package com.project.ai_resumerag_be.mapper;

import com.project.ai_resumerag_be.dto.request.JobSkillRequest;
import com.project.ai_resumerag_be.dto.response.JobResponse;
import com.project.ai_resumerag_be.entity.JobSkill;
import com.project.ai_resumerag_be.entity.Skill;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.List;

@Mapper(componentModel = "spring")
public interface JobSkillMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "job", ignore = true)
    @Mapping(target = "skill", ignore = true)
    JobSkill toEntity(JobSkillRequest request);

    List<JobSkill> toEntityList(List<JobSkillRequest> requests);

    @Mapping(target = "skillName", source = "skill.name")
    @Mapping(target = "skillCategory", source = "skill.category")
    JobResponse.SkillInfo toSkillInfo(JobSkill jobSkill);

    @Named("skillName")
    default String getSkillName(JobSkill jobSkill) {
        return jobSkill.getSkill() != null ? jobSkill.getSkill().getName() : null;
    }

    @Named("skillCategory")
    default String getSkillCategory(JobSkill jobSkill) {
        return jobSkill.getSkill() != null ? jobSkill.getSkill().getCategory() : null;
    }
}