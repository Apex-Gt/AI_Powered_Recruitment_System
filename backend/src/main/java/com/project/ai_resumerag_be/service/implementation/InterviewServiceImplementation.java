package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.request.InterviewFeedbackRequest;
import com.project.ai_resumerag_be.dto.request.InterviewRequest;
import com.project.ai_resumerag_be.dto.response.InterviewResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Interview;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.enumerators.Role;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.ApplicationStatus;
import com.project.ai_resumerag_be.enumerators.InterviewStatus;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.InterviewRepository;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.EmailService;
import com.project.ai_resumerag_be.service.InterviewService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class InterviewServiceImplementation implements InterviewService {

    /** Statuses a candidate is bumped out of when an interview is scheduled. */
    private static final List<ApplicationStatus> BEFORE_INTERVIEW =
            List.of(ApplicationStatus.APPLIED, ApplicationStatus.SCREENING, ApplicationStatus.SHORTLISTED);

    private final InterviewRepository interviewRepository;
    private final CandidateRepository candidateRepository;
    private final CandidateService candidateService;
    private final EmailService emailService;

    @Override
    @Transactional(readOnly = true)
    public List<InterviewResponse> list(InterviewStatus status, UUID candidateId, UUID jobId) {
        return interviewRepository.findByCandidateJobCompanyIdOrderByScheduledAtDesc(currentCompanyId()).stream()
                .filter(i -> canAccessJob(i.getCandidate().getJob()))
                .filter(i -> status == null || i.getStatus() == status)
                .filter(i -> candidateId == null || i.getCandidate().getId().equals(candidateId))
                .filter(i -> jobId == null || i.getCandidate().getJob().getId().equals(jobId))
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public InterviewResponse get(UUID interviewId) {
        return toResponse(findOwned(interviewId));
    }

    @Override
    public InterviewResponse schedule(InterviewRequest request) {
        Candidate candidate = candidateService.requireOwnedCandidate(request.getCandidateId());
        requireMatchingJob(candidate, request);
        if (!request.getScheduledAt().isAfter(LocalDateTime.now())) {
            throw new BadRequestException("Interview must be scheduled in the future");
        }
        if (candidate.getStatus() == ApplicationStatus.REJECTED) {
            throw new BadRequestException("Cannot schedule an interview for a rejected candidate");
        }

        Interview interview = Interview.builder()
                .candidate(candidate)
                .type(request.getType())
                .scheduledAt(request.getScheduledAt())
                .duration(request.getDuration())
                .interviewers(cleanList(request.getInterviewers()))
                .meetingLink(blankToNull(request.getMeetingLink()))
                .status(InterviewStatus.SCHEDULED)
                .createdBy(currentUser())
                .build();
        interview = interviewRepository.save(interview);

        if (BEFORE_INTERVIEW.contains(candidate.getStatus())) {
            candidate.setStatus(ApplicationStatus.INTERVIEW);
            candidateRepository.save(candidate);
        }

        notifyCandidate(interview, "scheduled");
        return toResponse(interview);
    }

    @Override
    public InterviewResponse update(UUID interviewId, InterviewRequest request) {
        Interview interview = findOwned(interviewId);
        if (interview.getStatus() != InterviewStatus.SCHEDULED) {
            throw new BadRequestException("Only scheduled interviews can be edited");
        }
        if (!interview.getCandidate().getId().equals(request.getCandidateId())) {
            throw new BadRequestException("The candidate of an interview cannot be changed");
        }
        requireMatchingJob(interview.getCandidate(), request);

        boolean timeOrLinkChanged = !interview.getScheduledAt().equals(request.getScheduledAt())
                || !Objects.equals(interview.getMeetingLink(), blankToNull(request.getMeetingLink()))
                || interview.getType() != request.getType();

        interview.setType(request.getType());
        interview.setScheduledAt(request.getScheduledAt());
        interview.setDuration(request.getDuration());
        interview.setInterviewers(cleanList(request.getInterviewers()));
        interview.setMeetingLink(blankToNull(request.getMeetingLink()));
        interview = interviewRepository.save(interview);

        if (timeOrLinkChanged) {
            notifyCandidate(interview, "rescheduled");
        }
        return toResponse(interview);
    }

    @Override
    public InterviewResponse cancel(UUID interviewId) {
        Interview interview = findOwned(interviewId);
        if (interview.getStatus() != InterviewStatus.SCHEDULED) {
            throw new BadRequestException("Only scheduled interviews can be cancelled");
        }
        interview.setStatus(InterviewStatus.CANCELLED);
        interview = interviewRepository.save(interview);
        notifyCandidate(interview, "cancelled");
        return toResponse(interview);
    }

    @Override
    public InterviewResponse submitFeedback(UUID interviewId, InterviewFeedbackRequest request) {
        Interview interview = findOwned(interviewId);
        if (interview.getStatus() == InterviewStatus.CANCELLED) {
            throw new BadRequestException("Cannot submit feedback for a cancelled interview");
        }

        interview.setFeedbackRating(request.getRating());
        interview.setFeedbackStrengths(cleanList(request.getStrengths()));
        interview.setFeedbackWeaknesses(cleanList(request.getWeaknesses()));
        interview.setFeedbackRecommendation(request.getRecommendation());
        interview.setFeedbackNotes(blankToNull(request.getNotes()));
        interview.setFeedbackSubmittedAt(LocalDateTime.now());
        interview.setFeedbackSubmittedBy(currentUser().getUserName());
        interview.setStatus(InterviewStatus.COMPLETED);
        return toResponse(interviewRepository.save(interview));
    }

    @Override
    public void delete(UUID interviewId) {
        interviewRepository.delete(findOwned(interviewId));
    }

    // -- helpers ---------------------------------------------------------------

    private Interview findOwned(UUID interviewId) {
        return interviewRepository.findByIdAndCandidateJobCompanyId(interviewId, currentCompanyId())
                .filter(i -> canAccessJob(i.getCandidate().getJob()))
                .orElseThrow(() -> new ResourceNotFoundException("Interview not found with id: " + interviewId));
    }

    /** Admins see every job of their company; a recruiter only the jobs they created. */
    private boolean canAccessJob(Job job) {
        User user = currentUser();
        return user.getRole() == Role.ADMIN
                || (job.getCreatedBy() != null && job.getCreatedBy().getId().equals(user.getId()));
    }

    private User currentUser() {
        return ((CustomUserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getUser();
    }

    private UUID currentCompanyId() {
        User user = currentUser();
        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("Company not found for current user");
        }
        return user.getCompany().getId();
    }

    private static void requireMatchingJob(Candidate candidate, InterviewRequest request) {
        if (request.getJobId() != null && !request.getJobId().equals(candidate.getJob().getId())) {
            throw new BadRequestException("The candidate did not apply for the selected job");
        }
    }

    private void notifyCandidate(Interview interview, String kind) {
        Candidate candidate = interview.getCandidate();
        emailService.sendInterviewNotice(
                candidate.getCandidateEmail(),
                candidate.getCandidateName(),
                candidate.getJob().getTitle(),
                candidate.getJob().getCompany().getCompanyName(),
                kind,
                interview.getType().name(),
                interview.getScheduledAt(),
                interview.getDuration(),
                interview.getMeetingLink());
    }

    private InterviewResponse toResponse(Interview i) {
        InterviewResponse.Feedback feedback = !i.hasFeedback() ? null : InterviewResponse.Feedback.builder()
                .rating(i.getFeedbackRating())
                .strengths(new ArrayList<>(i.getFeedbackStrengths()))
                .weaknesses(new ArrayList<>(i.getFeedbackWeaknesses()))
                .recommendation(i.getFeedbackRecommendation())
                .notes(i.getFeedbackNotes())
                .submittedAt(i.getFeedbackSubmittedAt())
                .submittedBy(i.getFeedbackSubmittedBy())
                .build();
        return InterviewResponse.builder()
                .id(i.getId())
                .candidateId(i.getCandidate().getId())
                .candidateName(i.getCandidate().getCandidateName())
                .jobId(i.getCandidate().getJob().getId())
                .jobTitle(i.getCandidate().getJob().getTitle())
                .type(i.getType())
                .scheduledAt(i.getScheduledAt())
                .duration(i.getDuration())
                .interviewers(new ArrayList<>(i.getInterviewers()))
                .status(i.getStatus())
                .meetingLink(i.getMeetingLink())
                .feedback(feedback)
                .build();
    }

    private static List<String> cleanList(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        return values.stream().map(String::trim).filter(v -> !v.isEmpty()).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
