package com.project.ai_resumerag_be.mapper;

import com.project.ai_resumerag_be.dto.response.JobResponse;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.JobSkill;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = JobSkillMapper.class)
public interface JobMapper {

    @Mapping(target = "skills", source = "skills")
    @Mapping(target = "company.id", source = "company.id")
    @Mapping(target = "company.companyName", source = "company.companyName")
    @Mapping(target = "createdBy.id", source = "createdBy.id")
    @Mapping(target = "createdBy.userName", source = "createdBy.userName")
    @Mapping(target = "createdBy.email", source = "createdBy.email")
    JobResponse toJobResponse(Job job);
}