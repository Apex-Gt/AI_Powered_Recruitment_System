package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.ai.*;
import com.project.ai_resumerag_be.dto.request.CandidateUploadRequest;
import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.Resume;
import com.project.ai_resumerag_be.mapper.CandidateMapper;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.JobRepository;
import com.project.ai_resumerag_be.repository.ResumeRepository;
import com.project.ai_resumerag_be.service.AIServiceClient;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateServiceImplementation implements CandidateService {

    private final CandidateRepository candidateRepository;
    private final JobRepository jobRepository;
    private final ResumeRepository resumeRepository;
    private final AIServiceClient aiServiceClient;
    private final FileStorageService fileStorageService;
    private final CandidateMapper candidateMapper;

    @Override
    @Transactional
    public Mono<CandidateResponse> uploadCandidateResume(CandidateUploadRequest request) {
        return Mono.fromCallable(() -> {
            Job job = jobRepository.findById(request.getJobId())
                    .orElseThrow(() -> new RuntimeException("Job not found: " + request.getJobId()));

            Resume resume = saveResume(request.getResumeFile(), job.getId());

            Candidate candidate = Candidate.builder()
                    .candidateName(request.getCandidateName())
                    .candidateEmail(request.getCandidateEmail())
                    .phoneNumber(request.getPhoneNumber())
                    .location(request.getLocation())
                    .job(job)
                    .resume(resume)
                    .build();

            candidate = candidateRepository.save(candidate);

            String pdfPath = fileStorageService.getFilePath(resume.getFileUrl());

            triggerIngestResume(candidate.getId(), resume.getId(), job.getId(), pdfPath).subscribe();

            return candidateMapper.toCandidateResponse(candidate);
        });
    }

    @Override
    @Transactional
    public Mono<List<CandidateResponse>> uploadBulkCandidateResumes(List<CandidateUploadRequest> requests) {
        return Mono.fromCallable(() -> {
            if (requests.isEmpty()) {
                throw new IllegalArgumentException("No candidates provided");
            }

            UUID jobId = requests.get(0).getJobId();
            Job job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new RuntimeException("Job not found: " + jobId));

            List<CandidateResponse> responses = requests.stream()
                    .map(req -> {
                        Resume resume = saveResume(req.getResumeFile(), jobId);

                        Candidate candidate = Candidate.builder()
                                .candidateName(req.getCandidateName())
                                .candidateEmail(req.getCandidateEmail())
                                .phoneNumber(req.getPhoneNumber())
                                .location(req.getLocation())
                                .job(job)
                                .resume(resume)
                                .build();

                        candidate = candidateRepository.save(candidate);

                        String pdfPath = fileStorageService.getFilePath(resume.getFileUrl());

                        triggerIngestResume(candidate.getId(), resume.getId(), jobId, pdfPath).subscribe();

                        return candidateMapper.toCandidateResponse(candidate);
                    })
                    .collect(Collectors.toList());

            return responses;
        });
    }

    private Resume saveResume(MultipartFile file, UUID jobId) {
        try {
            String fileName = file.getOriginalFilename();
            String fileUrl = fileStorageService.storeFile(file, "resumes/" + jobId);

            Resume resume = Resume.builder()
                    .fileName(fileName)
                    .fileUrl(fileUrl)
                    .build();

            return resumeRepository.save(resume);
        } catch (IOException e) {
            log.error("Failed to save resume file: {}", e.getMessage());
            throw new RuntimeException("Failed to save resume file", e);
        }
    }

    @Override
    public Mono<AIServiceResponse<Void>> triggerIngestResume(UUID candidateId, UUID resumeId, UUID jobId, String pdfPath) {
        IngestResumeEvent event = IngestResumeEvent.builder()
                .candidateId(candidateId)
                .resumeId(resumeId)
                .jobId(jobId)
                .pdfPath(pdfPath)
                .sourcePdf(resumeId.toString())
                .build();

        return aiServiceClient.ingestResume(event);
    }

    @Override
    public Mono<AIServiceResponse<Void>> triggerScoreJob(UUID candidateId, UUID jobId) {
        return Mono.fromCallable(() -> {
            Job job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new RuntimeException("Job not found: " + jobId));

            JobDescription jobDescription = buildJobDescription(job);

            ScoreJobEvent event = ScoreJobEvent.builder()
                    .candidateId(candidateId)
                    .jobId(jobId)
                    .jobDescription(jobDescription)
                    .build();

            return event;
        }).flatMap(aiServiceClient::scoreJob);
    }

    @Override
    public Mono<AIServiceResponse<Void>> triggerRAGSummary(UUID candidateId, UUID jobId) {
        RAGSummaryEvent event = RAGSummaryEvent.builder()
                .candidateId(candidateId)
                .jobId(jobId)
                .topK(10)
                .build();

        return aiServiceClient.generateRAGSummary(event);
    }

    @Override
    public Mono<AIServiceResponse<Void>> triggerRankCandidates(UUID jobId, List<UUID> candidateIds) {
        RankCandidatesEvent event = RankCandidatesEvent.builder()
                .jobId(jobId)
                .candidateIds(candidateIds)
                .build();

        return aiServiceClient.rankCandidates(event);
    }

    @Override
    public Mono<AIServiceResponse<MatchScore>> getMatchScore(UUID candidateId, UUID jobId) {
        return aiServiceClient.getMatchScore(candidateId, jobId);
    }

    @Override
    public Mono<AIServiceResponse<RAGSummary>> getRAGSummary(UUID candidateId, UUID jobId) {
        return aiServiceClient.getRAGSummary(candidateId, jobId);
    }

    @Override
    public Mono<AIServiceResponse<RankingResult>> getRanking(UUID jobId) {
        return aiServiceClient.getRanking(jobId);
    }

    @Override
    public Mono<AIServiceResponse<Void>> healthCheck() {
        return aiServiceClient.healthCheck();
    }

    private JobDescription buildJobDescription(Job job) {
        List<JobRequirement> requirements = job.getSkills() != null ? job.getSkills().stream()
                .map(js -> JobRequirement.builder()
                        .skill(js.getSkill().getName())
                        .required(true)
                        .weight(1.0)
                        .build())
                .collect(Collectors.toList()) : List.of();

        List<String> requiredSkills = job.getSkills() != null ? job.getSkills().stream()
                .map(js -> js.getSkill().getName())
                .collect(Collectors.toList()) : List.of();

        String educationLevel = job.getEducationRequired();

        return JobDescription.builder()
                .jobId(job.getId().toString())
                .title(job.getTitle())
                .companyId(job.getCompany().getId().toString())
                .description(job.getDescription())
                .requirements(requirements)
                .requiredSkills(requiredSkills)
                .preferredSkills(List.of())
                .minExperienceYears(job.getExperienceRequired() != null ? job.getExperienceRequired().doubleValue() : 0.0)
                .educationLevel(educationLevel)
                .location(job.getLocation())
                .employmentType(job.getEmploymentType() != null ? job.getEmploymentType().name() : null)
                .build();
    }
}