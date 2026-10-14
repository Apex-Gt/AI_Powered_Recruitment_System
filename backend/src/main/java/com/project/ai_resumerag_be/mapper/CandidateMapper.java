package com.project.ai_resumerag_be.mapper;

import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.factory.Mappers;

@Mapper(componentModel = "spring")
public interface CandidateMapper {

    CandidateMapper INSTANCE = Mappers.getMapper(CandidateMapper.class);

    @Mapping(source = "job.id", target = "jobId")
    @Mapping(source = "job.title", target = "jobTitle")
    @Mapping(source = "resume.id", target = "resumeId")
    @Mapping(source = "resume.fileName", target = "resumeFileName")
    @Mapping(source = "appliedAt", target = "appliedAt")
    @Mapping(target = "aiMatchScore", ignore = true)
    @Mapping(target = "experience", ignore = true)
    @Mapping(target = "skills", ignore = true)
    CandidateResponse toCandidateResponse(Candidate candidate);
}
