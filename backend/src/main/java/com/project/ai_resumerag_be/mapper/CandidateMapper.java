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
    @Mapping(source = "resume.id", target = "resumeId")
    CandidateResponse toCandidateResponse(Candidate candidate);
}