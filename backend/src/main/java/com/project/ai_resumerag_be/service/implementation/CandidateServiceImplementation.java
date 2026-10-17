package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.ai.*;
import com.project.ai_resumerag_be.dto.request.CandidateUpdateRequest;
import com.project.ai_resumerag_be.dto.request.CandidateUploadRequest;
import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.JobSkill;
import com.project.ai_resumerag_be.enumerators.SkillType;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.Role;
import com.project.ai_resumerag_be.exception.ConflictException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.entity.Resume;
import com.project.ai_resumerag_be.mapper.CandidateMapper;
import com.project.ai_resumerag_be.repository.AiResultRepository;
import com.project.ai_resumerag_be.repository.CandidateNoteRepository;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.AssessmentAttemptRepository;
import com.project.ai_resumerag_be.repository.InterviewRepository;
import com.project.ai_resumerag_be.repository.JobRepository;
import com.project.ai_resumerag_be.repository.ResumeRepository;
import com.project.ai_resumerag_be.service.AIServiceClient;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.FileStorageService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
    private final AiResultRepository aiResultRepository;
    private final CandidateNoteRepository candidateNoteRepository;
    private final InterviewRepository interviewRepository;
    private final AssessmentAttemptRepository assessmentAttemptRepository;
    private final AiResultStore aiResultStore;

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

            final UUID savedCandidateId = candidate.getId();
            triggerIngestResume(savedCandidateId, resume.getId(), job.getId(), pdfPath)
                    .subscribe(
                            ok -> log.info("Resume ingestion started for candidate {}", savedCandidateId),
                            err -> log.warn("Could not start resume ingestion for candidate {}: {}", savedCandidateId, err.getMessage()));

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

                        final UUID savedCandidateId = candidate.getId();
                        triggerIngestResume(savedCandidateId, resume.getId(), jobId, pdfPath)
                                .subscribe(
                                        ok -> log.info("Resume ingestion started for candidate {}", savedCandidateId),
                                        err -> log.warn("Could not start resume ingestion for candidate {}: {}", savedCandidateId, err.getMessage()));

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

    @Override
    @Transactional(readOnly = true)
    public JobDescription getJobDescription(UUID jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
        return buildJobDescription(job);
    }

    @Override
    @Transactional
    public CandidateResponse updateCandidate(UUID candidateId, CandidateUpdateRequest request) {
        Candidate candidate = findOwnedCandidate(candidateId);

        String email = request.getCandidateEmail().trim();
        boolean duplicate = candidateRepository.findByJobIdAndCandidateEmail(candidate.getJob().getId(), email).stream()
                .anyMatch(other -> !other.getId().equals(candidateId));
        if (duplicate) {
            throw new ConflictException("Another candidate with this email already applied for this job");
        }

        candidate.setCandidateName(request.getCandidateName().trim());
        candidate.setCandidateEmail(email);
        candidate.setPhoneNumber(blankToNull(request.getPhoneNumber()));
        candidate.setLocation(blankToNull(request.getLocation()));
        candidate = candidateRepository.save(candidate);

        CandidateResponse response = candidateMapper.toCandidateResponse(candidate);
        aiResultStore.enrich(response);
        return response;
    }

    @Override
    @Transactional
    public void deleteCandidate(UUID candidateId) {
        removeCandidates(List.of(findOwnedCandidate(candidateId)));
    }

    @Override
    @Transactional
    public void deleteCandidatesOfJob(UUID jobId) {
        removeCandidates(candidateRepository.findByJobId(jobId));
        aiResultRepository.deleteByJobId(jobId);
    }

    private void removeCandidates(List<Candidate> candidates) {
        if (candidates.isEmpty()) {
            return;
        }
        List<Resume> resumes = candidates.stream().map(Candidate::getResume).collect(Collectors.toList());
        List<UUID> candidateIds = candidates.stream().map(Candidate::getId).collect(Collectors.toList());

        candidateNoteRepository.deleteByCandidateIdIn(candidateIds);
        interviewRepository.deleteByCandidateIdIn(candidateIds);
        assessmentAttemptRepository.deleteByCandidateIdIn(candidateIds);
        // The candidate row holds the FK to its resume, so it has to go first.
        candidateRepository.deleteAll(candidates);
        candidateRepository.flush();
        resumeRepository.deleteAll(resumes);
        aiResultRepository.deleteByCandidateIdIn(candidateIds);

        for (Resume resume : resumes) {
            try {
                fileStorageService.deleteFile(resume.getFileUrl());
            } catch (IOException e) {
                log.warn("Could not delete resume file {}: {}", resume.getFileUrl(), e.getMessage());
            }
        }
        removeVectorsAfterCommit(candidateIds);
        log.info("Deleted {} candidate(s)", candidates.size());
    }

    /** Best effort: the vectors are only dropped once the DB delete has committed, and a failure is just logged. */
    private void removeVectorsAfterCommit(List<UUID> candidateIds) {
        Runnable removeVectors = () -> candidateIds.forEach(id -> aiServiceClient.deleteCandidate(id)
                .subscribe(
                        ok -> log.info("Removed AI vectors for candidate {}", id),
                        err -> log.warn("Could not remove AI vectors for candidate {}: {}", id, err.getMessage())));

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    removeVectors.run();
                }
            });
        } else {
            removeVectors.run();
        }
    }

    /** Loads a candidate, making sure it belongs to a job of the caller's company. */
    private User currentUser() {
        return ((CustomUserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getUser();
    }

    private UUID currentCompanyId() {
        User user = currentUser();
        if ((user.getRole() != Role.ADMIN && user.getRole() != Role.RECRUITER) || user.getCompany() == null) {
            throw new ResourceNotFoundException("Company not found for current user");
        }
        return user.getCompany().getId();
    }

    private Candidate findOwnedCandidate(UUID candidateId) {
        return requireOwnedCandidate(candidateId);
    }

    @Override
    public Candidate requireOwnedCandidate(UUID candidateId) {
        UUID companyId = currentCompanyId();
        return candidateRepository.findById(candidateId)
                .filter(c -> c.getJob().getCompany().getId().equals(companyId))
                .orElseThrow(() -> new ResourceNotFoundException("Candidate not found with id: " + candidateId));
    }

    @Override
    public Job requireOwnedJob(UUID jobId) {
        UUID companyId = currentCompanyId();
        return jobRepository.findById(jobId)
                .filter(j -> j.getCompany().getId().equals(companyId))
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
    }

    @Override
    public List<Candidate> findOwnedCandidates(UUID jobId) {
        UUID companyId = currentCompanyId();
        return jobId != null
                ? candidateRepository.findByJobIdAndJobCompanyId(jobId, companyId)
                : candidateRepository.findByJobCompanyId(companyId);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private JobDescription buildJobDescription(Job job) {
        List<JobSkill> jobSkills = job.getSkills() != null ? job.getSkills() : List.of();

        List<JobRequirement> requirements = jobSkills.stream()
                .map(js -> JobRequirement.builder()
                        .skill(js.getSkill().getName())
                        .required(js.getType() != SkillType.PREFERRED)
                        .weight(js.getWeight() != null ? Math.min(10.0, Math.max(0.0, js.getWeight().doubleValue() / 10.0)) : 1.0)
                        .build())
                .collect(Collectors.toList());

        List<String> requiredSkills = jobSkills.stream()
                .filter(js -> js.getType() != SkillType.PREFERRED)
                .map(js -> js.getSkill().getName())
                .collect(Collectors.toList());

        List<String> preferredSkills = jobSkills.stream()
                .filter(js -> js.getType() == SkillType.PREFERRED)
                .map(js -> js.getSkill().getName())
                .collect(Collectors.toList());

        return JobDescription.builder()
                .jobId(job.getId().toString())
                .title(job.getTitle())
                .companyId(job.getCompany().getId().toString())
                .description(job.getDescription())
                .requirements(requirements)
                .requiredSkills(requiredSkills)
                .preferredSkills(preferredSkills)
                .minExperienceYears(job.getExperienceRequired() != null ? job.getExperienceRequired().doubleValue() : 0.0)
                .educationLevel(toEducationLevel(job.getEducationRequired()))
                .location(job.getLocation())
                .employmentType(job.getEmploymentType() != null ? job.getEmploymentType().name() : null)
                .build();
    }

    /** Maps the free-text education requirement onto the AI service's enum (null when it is not recognised). */
    private static String toEducationLevel(String text) {
        if (text == null) {
            return null;
        }
        String t = text.toLowerCase();
        if (t.contains("phd") || t.contains("ph.d") || t.contains("doctor")) return "PHD";
        if (t.contains("master") || t.contains("msc") || t.contains("m.sc") || t.contains("mba") || t.contains("m.tech")
                || t.contains("postgrad")) return "MASTER";
        if (t.contains("bachelor") || t.contains("b.sc") || t.contains("bsc") || t.contains("b.tech") || t.contains("b.e")
                || t.contains("degree") || t.contains("undergrad")) return "BACHELOR";
        if (t.contains("associate") || t.contains("diploma")) return "ASSOCIATE";
        if (t.contains("high school") || t.contains("secondary")) return "HIGH_SCHOOL";
        return null;
    }
}
