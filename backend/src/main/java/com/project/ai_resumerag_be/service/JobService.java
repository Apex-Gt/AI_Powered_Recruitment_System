package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.request.JobRequest;
import com.project.ai_resumerag_be.dto.request.JobSkillRequest;
import com.project.ai_resumerag_be.dto.response.JobResponse;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

public interface JobService {
    CommonResponse createJob(@Valid JobRequest request);
    CommonResponse getMyJobs();
    CommonResponse getAllJobsForAdmin();
    CommonResponse getJobByIdForAdmin(UUID jobId);
    CommonResponse getJobByIdForRecruiter(UUID jobId);
    CommonResponse updateJobForAdmin(UUID jobId, JobRequest request);
    CommonResponse updateJobForRecruiter(UUID jobId, JobRequest request);
    CommonResponse updateJobSkills(UUID jobId, List<JobSkillRequest> skillRequests);
    CommonResponse deleteJobForAdmin(UUID jobId);
    CommonResponse deleteJobForRecruiter(UUID jobId);
}