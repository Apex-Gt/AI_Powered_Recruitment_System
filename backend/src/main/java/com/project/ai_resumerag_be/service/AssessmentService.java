package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.request.AssessmentRequest;
import com.project.ai_resumerag_be.dto.request.ManualGradeRequest;
import com.project.ai_resumerag_be.dto.response.AssessmentResponse;
import com.project.ai_resumerag_be.dto.response.AttemptResponse;
import com.project.ai_resumerag_be.entity.*;
import com.project.ai_resumerag_be.enumerators.AssessmentStatus;
import com.project.ai_resumerag_be.enumerators.AttemptStatus;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ConflictException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.AssessmentAttemptRepository;
import com.project.ai_resumerag_be.repository.AssessmentRepository;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/** Recruiter side of assessments: authoring, assigning to candidates and reviewing results. */
@Service
@RequiredArgsConstructor
@Transactional
public class AssessmentService {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final CandidateService candidateService;
    private final EmailService emailService;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${assessment.link-validity-days:7}")
    private int linkValidityDays;

    // -- assessments -----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<AssessmentResponse> list() {
        return assessmentRepository.findByCompanyIdOrderByCreatedAtDesc(currentCompanyId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AssessmentResponse get(UUID id) {
        return toResponse(findOwned(id));
    }

    public AssessmentResponse create(AssessmentRequest request) {
        User user = currentUser();
        Assessment assessment = Assessment.builder()
                .title(request.getTitle().trim())
                .type(request.getType())
                .duration(request.getDuration())
                .status(request.getStatus() != null ? request.getStatus() : AssessmentStatus.ACTIVE)
                .company(user.getCompany())
                .createdBy(user)
                .build();
        applyQuestions(assessment, request.getQuestions());
        return toResponse(assessmentRepository.save(assessment));
    }

    public AssessmentResponse update(UUID id, AssessmentRequest request) {
        Assessment assessment = findOwned(id);
        List<AssessmentQuestion> replacement = buildQuestions(assessment, request.getQuestions());

        if (!sameQuestions(assessment.getQuestions(), replacement) && hasAttempts(assessment.getId())) {
            throw new ConflictException("Questions cannot be changed once the assessment was sent to candidates");
        }

        assessment.setTitle(request.getTitle().trim());
        assessment.setType(request.getType());
        assessment.setDuration(request.getDuration());
        if (request.getStatus() != null) {
            assessment.setStatus(request.getStatus());
        }
        if (!sameQuestions(assessment.getQuestions(), replacement)) {
            assessment.getQuestions().clear();
            assessment.getQuestions().addAll(replacement);
        }
        return toResponse(assessmentRepository.save(assessment));
    }

    /** Deletes the assessment together with every attempt (and answer) made on it. */
    public void delete(UUID id) {
        Assessment assessment = findOwned(id);
        attemptRepository.deleteByAssessmentId(assessment.getId());
        attemptRepository.flush();
        assessmentRepository.delete(assessment);
    }

    // -- attempts --------------------------------------------------------------

    /** Sends the assessment to a candidate; the response carries the link in case email is not configured. */
    public AttemptResponse assign(UUID assessmentId, UUID candidateId) {
        Assessment assessment = findOwned(assessmentId);
        if (assessment.getStatus() != AssessmentStatus.ACTIVE) {
            throw new BadRequestException("Only active assessments can be assigned");
        }
        Candidate candidate = candidateService.requireOwnedCandidate(candidateId);

        if (hasOpenAttempt(assessmentId, candidateId)) {
            throw new ConflictException("This assessment is already assigned to the candidate and not yet finished");
        }

        String token = AttemptRules.newToken();
        AssessmentAttempt attempt = attemptRepository.save(AssessmentAttempt.builder()
                .assessment(assessment)
                .candidate(candidate)
                .tokenHash(AttemptRules.hash(token))
                .status(AttemptStatus.ASSIGNED)
                .expiresAt(LocalDateTime.now().plusDays(linkValidityDays))
                .assignedBy(currentUser())
                .build());

        String link = frontendUrl + "/assess/" + token;
        emailService.sendAssessmentInvite(candidate.getCandidateEmail(), candidate.getCandidateName(),
                assessment.getTitle(), assessment.getCompany().getCompanyName(), link,
                assessment.getDuration(), attempt.getExpiresAt());

        AttemptResponse.AttemptResponseBuilder response = summaryBuilder(attempt);
        return response.link(link).build();
    }

    @Transactional(readOnly = true)
    public List<AttemptResponse> listAttempts(UUID assessmentId, UUID candidateId) {
        return attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(currentCompanyId()).stream()
                .filter(a -> assessmentId == null || a.getAssessment().getId().equals(assessmentId))
                .filter(a -> candidateId == null || a.getCandidate().getId().equals(candidateId))
                .map(a -> summaryBuilder(a).build())
                .toList();
    }

    @Transactional(readOnly = true)
    public AttemptResponse getAttempt(UUID attemptId) {
        return detail(findOwnedAttempt(attemptId));
    }

    /** A recruiter scores an answer the AI could not (video, or AI unavailable) or overrides a score. */
    public AttemptResponse gradeAnswer(UUID attemptId, UUID answerId, ManualGradeRequest request) {
        AssessmentAttempt attempt = findOwnedAttempt(attemptId);
        if (attempt.getStatus() != AttemptStatus.SUBMITTED && attempt.getStatus() != AttemptStatus.GRADED) {
            throw new BadRequestException("Answers can only be graded after the candidate submitted");
        }
        AttemptAnswer answer = attempt.getAnswers().stream()
                .filter(a -> a.getId().equals(answerId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Answer not found: " + answerId));

        answer.setScore(Math.round(request.getScore() * 10.0) / 10.0);
        answer.setFeedback(request.getFeedback() == null || request.getFeedback().isBlank() ? null : request.getFeedback().trim());
        answer.setNeedsReview(false);
        AttemptRules.recompute(attempt);
        return detail(attemptRepository.save(attempt));
    }

    // -- helpers ---------------------------------------------------------------

    private boolean hasOpenAttempt(UUID assessmentId, UUID candidateId) {
        // An old link that already ran out of time must not block re-assigning.
        LocalDateTime now = LocalDateTime.now();
        return attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(currentCompanyId()).stream()
                .filter(a -> a.getAssessment().getId().equals(assessmentId) && a.getCandidate().getId().equals(candidateId))
                .anyMatch(a -> {
                    AttemptStatus s = AttemptRules.effectiveStatus(a, now);
                    return s == AttemptStatus.ASSIGNED || s == AttemptStatus.IN_PROGRESS;
                });
    }

    private boolean hasAttempts(UUID assessmentId) {
        return attemptRepository.existsByAssessmentId(assessmentId);
    }

    private void applyQuestions(Assessment assessment, List<AssessmentRequest.QuestionRequest> requests) {
        assessment.getQuestions().clear();
        assessment.getQuestions().addAll(buildQuestions(assessment, requests));
    }

    private List<AssessmentQuestion> buildQuestions(Assessment assessment, List<AssessmentRequest.QuestionRequest> requests) {
        List<AssessmentQuestion> questions = new ArrayList<>();
        int position = 0;
        for (AssessmentRequest.QuestionRequest r : requests) {
            List<String> options = new ArrayList<>();
            String correct = null;
            if (r.getType() == QuestionType.MULTIPLE_CHOICE) {
                for (String option : r.getOptions() == null ? List.<String>of() : r.getOptions()) {
                    String trimmed = option == null ? "" : option.trim();
                    if (!trimmed.isEmpty() && !options.contains(trimmed)) {
                        options.add(trimmed);
                    }
                }
                correct = r.getCorrectAnswer() == null ? "" : r.getCorrectAnswer().trim();
                if (options.size() < 2) {
                    throw new BadRequestException("Multiple choice question " + (position + 1) + " needs at least two distinct options");
                }
                if (!options.contains(correct)) {
                    throw new BadRequestException("Multiple choice question " + (position + 1) + " needs a correct answer that is one of its options");
                }
            }
            questions.add(AssessmentQuestion.builder()
                    .assessment(assessment)
                    .position(position++)
                    .question(r.getQuestion().trim())
                    .type(r.getType())
                    .options(options)
                    .correctAnswer(correct)
                    .weight(r.getWeight())
                    .build());
        }
        return questions;
    }

    private static boolean sameQuestions(List<AssessmentQuestion> current, List<AssessmentQuestion> replacement) {
        if (current.size() != replacement.size()) {
            return false;
        }
        for (int i = 0; i < current.size(); i++) {
            AssessmentQuestion a = current.get(i);
            AssessmentQuestion b = replacement.get(i);
            if (!a.getQuestion().equals(b.getQuestion()) || a.getType() != b.getType()
                    || !a.getOptions().equals(b.getOptions()) || !Objects.equals(a.getCorrectAnswer(), b.getCorrectAnswer())
                    || !a.getWeight().equals(b.getWeight())) {
                return false;
            }
        }
        return true;
    }

    private Assessment findOwned(UUID id) {
        return assessmentRepository.findByIdAndCompanyId(id, currentCompanyId())
                .orElseThrow(() -> new ResourceNotFoundException("Assessment not found with id: " + id));
    }

    private AssessmentAttempt findOwnedAttempt(UUID id) {
        return attemptRepository.findByIdAndAssessmentCompanyId(id, currentCompanyId())
                .orElseThrow(() -> new ResourceNotFoundException("Assessment attempt not found with id: " + id));
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

    private AssessmentResponse toResponse(Assessment a) {
        return AssessmentResponse.builder()
                .id(a.getId())
                .title(a.getTitle())
                .type(a.getType())
                .duration(a.getDuration())
                .status(a.getStatus())
                .createdAt(a.getCreatedAt())
                .questions(a.getQuestions().stream().map(q -> AssessmentResponse.Question.builder()
                        .id(q.getId())
                        .question(q.getQuestion())
                        .type(q.getType())
                        .options(new ArrayList<>(q.getOptions()))
                        .correctAnswer(q.getCorrectAnswer())
                        .weight(q.getWeight())
                        .build()).toList())
                .build();
    }

    private AttemptResponse.AttemptResponseBuilder summaryBuilder(AssessmentAttempt a) {
        return AttemptResponse.builder()
                .id(a.getId())
                .assessmentId(a.getAssessment().getId())
                .assessmentTitle(a.getAssessment().getTitle())
                .candidateId(a.getCandidate().getId())
                .candidateName(a.getCandidate().getCandidateName())
                .status(AttemptRules.effectiveStatus(a, LocalDateTime.now()))
                .totalScore(a.getTotalScore())
                .assignedAt(a.getCreatedAt())
                .expiresAt(a.getExpiresAt())
                .startedAt(a.getStartedAt())
                .submittedAt(a.getSubmittedAt())
                .pendingReview((int) a.getAnswers().stream().filter(AttemptAnswer::isNeedsReview).count());
    }

    private AttemptResponse detail(AssessmentAttempt a) {
        return summaryBuilder(a)
                .answers(a.getAnswers().stream()
                        .sorted(Comparator.comparing(x -> x.getQuestion().getPosition()))
                        .map(x -> AttemptResponse.Answer.builder()
                                .id(x.getId())
                                .questionId(x.getQuestion().getId())
                                .question(x.getQuestion().getQuestion())
                                .type(x.getQuestion().getType())
                                .weight(x.getQuestion().getWeight())
                                .answer(x.getAnswer())
                                .correctAnswer(x.getQuestion().getCorrectAnswer())
                                .score(x.getScore())
                                .feedback(x.getFeedback())
                                .needsReview(x.isNeedsReview())
                                .build())
                        .toList())
                .build();
    }
}
