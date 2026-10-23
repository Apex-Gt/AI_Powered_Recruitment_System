package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.response.BulkAssignResponse;
import com.project.ai_resumerag_be.entity.*;
import com.project.ai_resumerag_be.enums.AssessmentStatus;
import com.project.ai_resumerag_be.enums.AttemptStatus;
import com.project.ai_resumerag_be.enums.Role;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.AssessmentAttemptRepository;
import com.project.ai_resumerag_be.repository.AssessmentRepository;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AssessmentBulkAssignTest {

    @Mock AssessmentRepository assessmentRepository;
    @Mock AssessmentAttemptRepository attemptRepository;
    @Mock CandidateService candidateService;
    @Mock EmailService emailService;

    private AssessmentService service;
    private Company company;
    private Assessment assessment;

    @BeforeEach
    void setUp() {
        service = new AssessmentService(assessmentRepository, attemptRepository, candidateService, emailService);
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(service, "linkValidityDays", 7);

        company = Company.builder().id(UUID.randomUUID()).companyName("Acme").build();
        User recruiter = User.builder().id(UUID.randomUUID()).role(Role.RECRUITER).company(company).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new CustomUserDetails(recruiter), null));

        assessment = Assessment.builder().id(UUID.randomUUID()).title("Java quiz").duration(30).company(company)
                .status(AssessmentStatus.ACTIVE).questions(new ArrayList<>()).build();
        lenient().when(assessmentRepository.findByIdAndCompanyId(assessment.getId(), company.getId()))
                .thenReturn(Optional.of(assessment));
        lenient().when(attemptRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttempt a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            a.setCreatedAt(LocalDateTime.now());
            return a;
        });
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private Candidate candidate(String name) {
        Candidate c = Candidate.builder().id(UUID.randomUUID()).candidateName(name).candidateEmail(name + "@example.com").build();
        lenient().when(candidateService.requireOwnedCandidate(c.getId())).thenReturn(c);
        return c;
    }

    @Test
    void sendsToEveryoneAndEmailsEachOne() {
        Candidate a = candidate("ann");
        Candidate b = candidate("bob");
        Candidate c = candidate("cat");
        when(attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(company.getId())).thenReturn(List.of());

        BulkAssignResponse result = service.assignMany(assessment.getId(), List.of(a.getId(), b.getId(), c.getId()));

        assertEquals(3, result.getSent().size());
        assertTrue(result.getSkipped().isEmpty());
        assertTrue(result.getSent().stream().allMatch(s -> s.getLink().startsWith("http://localhost:3000/assess/")));
        assertEquals(3, result.getSent().stream().map(s -> s.getLink()).distinct().count());
        verify(emailService, times(3)).sendAssessmentInvite(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), any());
    }

    @Test
    void skipsWhoeverAlreadyHasItOpenOrIsNotFoundWithoutFailingTheRest() {
        Candidate fresh = candidate("ann");
        Candidate busy = candidate("bob");
        UUID ghost = UUID.randomUUID();
        when(candidateService.requireOwnedCandidate(ghost)).thenThrow(new ResourceNotFoundException("nope"));
        AssessmentAttempt open = AssessmentAttempt.builder().assessment(assessment).candidate(busy)
                .status(AttemptStatus.ASSIGNED).expiresAt(LocalDateTime.now().plusDays(2)).answers(new ArrayList<>()).build();
        when(attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(company.getId())).thenReturn(List.of(open));

        BulkAssignResponse result = service.assignMany(assessment.getId(), List.of(fresh.getId(), busy.getId(), ghost));

        assertEquals(1, result.getSent().size());
        assertEquals("ann", result.getSent().get(0).getCandidateName());
        assertEquals(2, result.getSkipped().size());
        assertTrue(result.getSkipped().stream().anyMatch(s -> "bob".equals(s.getCandidateName()) && s.getReason().contains("Already")));
        assertTrue(result.getSkipped().stream().anyMatch(s -> ghost.equals(s.getCandidateId())));
        verify(emailService, times(1)).sendAssessmentInvite(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), any());
    }

    @Test
    void anOldLinkThatRanOutDoesNotBlockSendingAgain() {
        Candidate returning = candidate("ann");
        AssessmentAttempt lapsed = AssessmentAttempt.builder().assessment(assessment).candidate(returning)
                .status(AttemptStatus.ASSIGNED).expiresAt(LocalDateTime.now().minusDays(1)).answers(new ArrayList<>()).build();
        when(attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(company.getId())).thenReturn(List.of(lapsed));

        BulkAssignResponse result = service.assignMany(assessment.getId(), List.of(returning.getId()));

        assertEquals(1, result.getSent().size());
        assertTrue(result.getSkipped().isEmpty());
    }

    @Test
    void duplicateIdsInTheRequestAreSentOnce() {
        Candidate a = candidate("ann");
        when(attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(company.getId())).thenReturn(List.of());

        BulkAssignResponse result = service.assignMany(assessment.getId(), List.of(a.getId(), a.getId()));

        assertEquals(1, result.getSent().size());
        verify(emailService, times(1)).sendAssessmentInvite(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), any());
    }

    @Test
    void inactiveAssessmentCannotBeSent() {
        assessment.setStatus(AssessmentStatus.DRAFT);

        assertThrows(BadRequestException.class, () -> service.assignMany(assessment.getId(), List.of(UUID.randomUUID())));
        verifyNoInteractions(emailService);
    }
}
