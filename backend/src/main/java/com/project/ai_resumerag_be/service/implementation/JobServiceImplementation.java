package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.request.JobRequest;
import com.project.ai_resumerag_be.dto.request.JobSkillRequest;
import com.project.ai_resumerag_be.dto.response.JobResponse;
import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.JobSkill;
import com.project.ai_resumerag_be.entity.Skill;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
import com.project.ai_resumerag_be.enumerators.JobStatus;
import com.project.ai_resumerag_be.enumerators.Role;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.mapper.JobMapper;
import com.project.ai_resumerag_be.mapper.JobSkillMapper;
import com.project.ai_resumerag_be.repository.JobRepository;
import com.project.ai_resumerag_be.repository.SkillRepository;
import com.project.ai_resumerag_be.service.JobService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobServiceImplementation implements JobService {

    private final JobRepository jobRepository;
    private final SkillRepository skillRepository;
    private final JobSkillMapper jobSkillMapper;
    private final JobMapper jobMapper;

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        return customUserDetails.getUser();
    }

    private void validateSalary(BigDecimal minimumSalary, BigDecimal maximumSalary) {
        if (minimumSalary != null && maximumSalary != null && maximumSalary.compareTo(minimumSalary) < 0) {
            throw new IllegalArgumentException("Maximum salary must be greater than or equal to minimum salary");
        }
    }

    private void validateApplicationDeadline(LocalDate deadline) {
        if (deadline != null && deadline.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Application deadline must be today or in the future");
        }
    }

    @Override
    public CommonResponse createJob(JobRequest request) {
        User user = getCurrentUser();

        if (user.getRole() != Role.RECRUITER && user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only recruiters and admins can create jobs");
        }

        Company company = user.getCompany();
        if (company == null) {
            throw new ResourceNotFoundException("User is not associated with a company");
        }

        validateSalary(request.getMinimumSalary(), request.getMaximumSalary());
        validateApplicationDeadline(request.getApplicationDeadline());

        Job job = Job.builder()
                .title(request.getTitle())
                .department(request.getDepartment())
                .employmentType(request.getEmploymentType())
                .workMode(request.getWorkMode())
                .location(request.getLocation())
                .experienceRequired(request.getExperienceRequired())
                .educationRequired(request.getEducationRequired())
                .minimumSalary(request.getMinimumSalary())
                .maximumSalary(request.getMaximumSalary())
                .salaryCurrency(request.getSalaryCurrency())
                .description(request.getDescription())
                .applicationDeadline(request.getApplicationDeadline())
                .vacancies(request.getVacancies())
                .status(JobStatus.OPEN)
                .company(company)
                .createdBy(user)
                .build();

        List<JobSkill> skills = buildJobSkills(job, request.getSkills());
        job.setSkills(skills);

        Job savedJob = jobRepository.save(job);

        log.info("Job created successfully with id: {} by user: {}", savedJob.getId(), user.getEmail());

        return CommonResponse.builder()
                .code(201)
                .data(jobMapper.toJobResponse(savedJob))
                .message("Job created successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private List<JobSkill> buildJobSkills(Job job, List<JobSkillRequest> skillRequests) {
        return skillRequests.stream()
                .map(req -> {
                    Skill skill = resolveSkill(req);
                    JobSkill jobSkill = jobSkillMapper.toEntity(req);
                    jobSkill.setJob(job);
                    jobSkill.setSkill(skill);
                    return jobSkill;
                })
                .collect(Collectors.toList());
    }

    private Skill resolveSkill(JobSkillRequest request) {
        if (request.getSkillId() != null) {
            return skillRepository.findById(request.getSkillId())
                    .orElseThrow(() -> new RuntimeException("Skill not found with id: " + request.getSkillId()));
        }

        if (request.getSkillName() != null && !request.getSkillName().isBlank()) {
            return skillRepository.findByName(request.getSkillName().trim())
                    .orElseGet(() -> {
                        Skill newSkill = Skill.builder()
                                .name(request.getSkillName().trim())
                                .category(request.getSkillCategory())
                                .build();
                        return skillRepository.save(newSkill);
                    });
        }

        throw new RuntimeException("Either skillId or skillName must be provided");
    }

    @Override
    public CommonResponse getMyJobs() {
        User user = getCurrentUser();

        List<Job> jobs;
        if (user.getRole() == Role.ADMIN) {
            jobs = jobRepository.findByCompany(user.getCompany());
        } else {
            jobs = jobRepository.findByCreatedBy(user);
        }

        List<JobResponse> jobResponses = jobs.stream()
                .map(jobMapper::toJobResponse)
                .collect(Collectors.toList());

        return CommonResponse.builder()
                .code(200)
                .data(jobResponses)
                .message("Jobs retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getAllJobsForAdmin() {
        User user = getCurrentUser();

        if (user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        List<Job> jobs = jobRepository.findByCompany(user.getCompany());

        List<JobResponse> jobResponses = jobs.stream()
                .map(jobMapper::toJobResponse)
                .collect(Collectors.toList());

        return CommonResponse.builder()
                .code(200)
                .data(jobResponses)
                .message("Jobs retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getJobByIdForAdmin(UUID jobId) {
        User user = getCurrentUser();

        if (user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        Job job = jobRepository.findByIdAndCompany(jobId, user.getCompany())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

        return CommonResponse.builder()
                .code(200)
                .data(jobMapper.toJobResponse(job))
                .message("Job retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getJobByIdForRecruiter(UUID jobId) {
        User user = getCurrentUser();

        if (user.getRole() != Role.RECRUITER && user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only recruiters and admins can access this resource");
        }

        if (user.getRole() == Role.RECRUITER) {
            Job job = jobRepository.findByIdAndCreatedBy(jobId, user)
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found or access denied"));

            return CommonResponse.builder()
                    .code(200)
                    .data(jobMapper.toJobResponse(job))
                    .message("Job retrieved successfully")
                    .status(CommonResponseStatus.SUCCESS)
                    .timestamp(LocalDateTime.now())
                    .build();
        } else {
            // ADMIN can also access via this endpoint
            return getJobByIdForAdmin(jobId);
        }
    }

    private void updateJobFields(Job job, JobRequest request) {
        if (request.getTitle() != null) {
            job.setTitle(request.getTitle());
        }
        if (request.getDepartment() != null) {
            job.setDepartment(request.getDepartment());
        }
        if (request.getEmploymentType() != null) {
            job.setEmploymentType(request.getEmploymentType());
        }
        if (request.getWorkMode() != null) {
            job.setWorkMode(request.getWorkMode());
        }
        if (request.getLocation() != null) {
            job.setLocation(request.getLocation());
        }
        if (request.getExperienceRequired() != null) {
            job.setExperienceRequired(request.getExperienceRequired());
        }
        if (request.getEducationRequired() != null) {
            job.setEducationRequired(request.getEducationRequired());
        }
        if (request.getMinimumSalary() != null) {
            job.setMinimumSalary(request.getMinimumSalary());
        }
        if (request.getMaximumSalary() != null) {
            job.setMaximumSalary(request.getMaximumSalary());
        }
        if (request.getSalaryCurrency() != null) {
            job.setSalaryCurrency(request.getSalaryCurrency());
        }
        if (request.getDescription() != null) {
            job.setDescription(request.getDescription());
        }
        if (request.getApplicationDeadline() != null) {
            job.setApplicationDeadline(request.getApplicationDeadline());
        }
        if (request.getVacancies() != null) {
            job.setVacancies(request.getVacancies());
        }
        if (request.getStatus() != null) {
            job.setStatus(request.getStatus());
        }
        // Cannot change: companyId, createdBy, createdAt, skills (use updateJobSkills endpoint)
    }

    @Transactional
    @Override
    public CommonResponse updateJobForAdmin(UUID jobId, JobRequest request) {
        User user = getCurrentUser();

        if (user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        Job job = jobRepository.findByIdAndCompany(jobId, user.getCompany())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

        validateSalary(request.getMinimumSalary(), request.getMaximumSalary());
        validateApplicationDeadline(request.getApplicationDeadline());

        updateJobFields(job, request);

        job = jobRepository.save(job);

        return CommonResponse.builder()
                .code(200)
                .data(jobMapper.toJobResponse(job))
                .message("Job updated successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse updateJobForRecruiter(UUID jobId, JobRequest request) {
        User user = getCurrentUser();

        if (user.getRole() != Role.RECRUITER && user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only recruiters and admins can access this resource");
        }

        Job job;
        if (user.getRole() == Role.RECRUITER) {
            job = jobRepository.findByIdAndCreatedBy(jobId, user)
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found or access denied"));
        } else {
            // ADMIN can also update via this endpoint
            if (user.getCompany() == null) {
                throw new ResourceNotFoundException("Admin is not associated with a company");
            }
            job = jobRepository.findByIdAndCompany(jobId, user.getCompany())
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        }

        validateSalary(request.getMinimumSalary(), request.getMaximumSalary());
        validateApplicationDeadline(request.getApplicationDeadline());

        updateJobFields(job, request);

        job = jobRepository.save(job);

        return CommonResponse.builder()
                .code(200)
                .data(jobMapper.toJobResponse(job))
                .message("Job updated successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse deleteJobForAdmin(UUID jobId) {
        User user = getCurrentUser();

        if (user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        Job job = jobRepository.findByIdAndCompany(jobId, user.getCompany())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

        jobRepository.delete(job);

        return CommonResponse.builder()
                .code(200)
                .message("Job deleted successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse deleteJobForRecruiter(UUID jobId) {
        User user = getCurrentUser();

        if (user.getRole() != Role.RECRUITER && user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only recruiters and admins can access this resource");
        }

        Job job;
        if (user.getRole() == Role.RECRUITER) {
            // Recruiters can only delete their own jobs
            job = jobRepository.findByIdAndCreatedBy(jobId, user)
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found or access denied"));
        } else {
            // ADMIN can also delete via this endpoint
            if (user.getCompany() == null) {
                throw new ResourceNotFoundException("Admin is not associated with a company");
            }
            job = jobRepository.findByIdAndCompany(jobId, user.getCompany())
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        }

        jobRepository.delete(job);

        return CommonResponse.builder()
                .code(200)
                .message("Job deleted successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse updateJobSkills(UUID jobId, List<JobSkillRequest> skillRequests) {
        User user = getCurrentUser();

        if (user.getRole() != Role.RECRUITER && user.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only recruiters and admins can update job skills");
        }

        Job job;
        if (user.getRole() == Role.RECRUITER) {
            job = jobRepository.findByIdAndCreatedBy(jobId, user)
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found or access denied"));
        } else {
            if (user.getCompany() == null) {
                throw new ResourceNotFoundException("Admin is not associated with a company");
            }
            job = jobRepository.findByIdAndCompany(jobId, user.getCompany())
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        }

        if (skillRequests == null || skillRequests.isEmpty()) {
            throw new IllegalArgumentException("At least one skill is required");
        }

        // Clear existing skills and add new ones
        job.getSkills().clear();
        List<JobSkill> skills = buildJobSkills(job, skillRequests);
        job.getSkills().addAll(skills);

        job = jobRepository.save(job);

        return CommonResponse.builder()
                .code(200)
                .data(jobMapper.toJobResponse(job))
                .message("Job skills updated successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }
}