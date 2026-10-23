package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.request.InterviewFeedbackRequest;
import com.project.ai_resumerag_be.dto.request.InterviewRequest;
import com.project.ai_resumerag_be.dto.response.InterviewResponse;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.Interview;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enums.ApplicationStatus;
import com.project.ai_resumerag_be.enums.InterviewRecommendation;
import com.project.ai_resumerag_be.enums.InterviewStatus;
import com.project.ai_resumerag_be.enums.InterviewType;
import com.project.ai_resumerag_be.enums.Role;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.InterviewRepository;
import com.project.ai_resumerag_be.service.impl.InterviewServiceImplementation;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterviewServiceTest {

    @Mock InterviewRepository interviewRepository;
    @Mock CandidateRepository candidateRepository;
    @Mock CandidateService candidateService;
    @Mock EmailService emailService;
    @InjectMocks InterviewServiceImplementation service;

    private Company company;
    private User recruiter;
    private Candidate candidate;

    @BeforeEach
    void setUp() {
        company = Company.builder().id(UUID.randomUUID()).companyName("Acme").build();
        recruiter = User.builder().id(UUID.randomUUID()).userName("rita").role(Role.RECRUITER).company(company).build();
        Job job = Job.builder().id(UUID.randomUUID()).title("Java Dev").company(company).createdBy(recruiter).build();
        candidate = Candidate.builder().id(UUID.randomUUID()).candidateName("Cam").candidateEmail("cam@x.com")
                .status(ApplicationStatus.SHORTLISTED).job(job).build();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new CustomUserDetails(recruiter), null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private InterviewRequest request(LocalDateTime when) {
        return InterviewRequest.builder().candidateId(candidate.getId()).type(InterviewType.VIDEO)
                .scheduledAt(when).duration(60).interviewers(List.of(" Ann ", "")).meetingLink("https://meet.example/x").build();
    }

    private Interview scheduled(InterviewStatus status) {
        return Interview.builder().id(UUID.randomUUID()).candidate(candidate).type(InterviewType.VIDEO)
                .scheduledAt(LocalDateTime.now().plusDays(1)).duration(60).status(status).createdBy(recruiter).build();
    }

    @Test
    void scheduleSavesNotifiesAndMovesCandidateToInterview() {
        when(candidateService.requireOwnedCandidate(candidate.getId())).thenReturn(candidate);
        when(interviewRepository.save(any(Interview.class))).thenAnswer(inv -> inv.getArgument(0));

        InterviewResponse response = service.schedule(request(LocalDateTime.now().plusDays(1)));

        assertEquals(InterviewStatus.SCHEDULED, response.getStatus());
        assertEquals(List.of("Ann"), response.getInterviewers());
        assertEquals(ApplicationStatus.INTERVIEW, candidate.getStatus());
        verify(candidateRepository).save(candidate);
        verify(emailService).sendInterviewNotice(eq("cam@x.com"), eq("Cam"), eq("Java Dev"), eq("Acme"),
                eq("scheduled"), eq("VIDEO"), any(), anyInt(), eq("https://meet.example/x"));
    }

    @Test
    void scheduleRejectsPastTimeAndRejectedCandidates() {
        when(candidateService.requireOwnedCandidate(candidate.getId())).thenReturn(candidate);

        assertThrows(BadRequestException.class, () -> service.schedule(request(LocalDateTime.now().minusHours(1))));

        candidate.setStatus(ApplicationStatus.REJECTED);
        assertThrows(BadRequestException.class, () -> service.schedule(request(LocalDateTime.now().plusDays(1))));
        verify(interviewRepository, never()).save(any());
        verifyNoInteractions(emailService);
    }

    @Test
    void scheduleRejectsJobThatIsNotTheCandidatesJob() {
        when(candidateService.requireOwnedCandidate(candidate.getId())).thenReturn(candidate);
        InterviewRequest request = request(LocalDateTime.now().plusDays(1));
        request.setJobId(UUID.randomUUID());

        assertThrows(BadRequestException.class, () -> service.schedule(request));
    }

    @Test
    void cancelOnlyWorksForScheduledInterviews() {
        Interview done = scheduled(InterviewStatus.COMPLETED);
        when(interviewRepository.findByIdAndCandidateJobCompanyId(done.getId(), company.getId())).thenReturn(Optional.of(done));
        assertThrows(BadRequestException.class, () -> service.cancel(done.getId()));

        Interview open = scheduled(InterviewStatus.SCHEDULED);
        when(interviewRepository.findByIdAndCandidateJobCompanyId(open.getId(), company.getId())).thenReturn(Optional.of(open));
        when(interviewRepository.save(open)).thenReturn(open);

        assertEquals(InterviewStatus.CANCELLED, service.cancel(open.getId()).getStatus());
        verify(emailService).sendInterviewNotice(any(), any(), any(), any(), eq("cancelled"), any(), any(), anyInt(), any());
    }

    @Test
    void feedbackCompletesInterviewAndRecordsAuthor() {
        Interview interview = scheduled(InterviewStatus.SCHEDULED);
        when(interviewRepository.findByIdAndCandidateJobCompanyId(interview.getId(), company.getId())).thenReturn(Optional.of(interview));
        when(interviewRepository.save(interview)).thenReturn(interview);

        InterviewResponse response = service.submitFeedback(interview.getId(), InterviewFeedbackRequest.builder()
                .rating(4).recommendation(InterviewRecommendation.HIRE).strengths(List.of("Clear thinker")).notes("  good ").build());

        assertEquals(InterviewStatus.COMPLETED, response.getStatus());
        assertEquals("rita", response.getFeedback().getSubmittedBy());
        assertEquals("good", response.getFeedback().getNotes());
        assertEquals(InterviewRecommendation.HIRE, response.getFeedback().getRecommendation());
    }

    @Test
    void interviewsOfAnotherCompanyAreNotFound() {
        UUID id = UUID.randomUUID();
        when(interviewRepository.findByIdAndCandidateJobCompanyId(id, company.getId())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.get(id));
        assertThrows(ResourceNotFoundException.class, () -> service.delete(id));
    }
}
