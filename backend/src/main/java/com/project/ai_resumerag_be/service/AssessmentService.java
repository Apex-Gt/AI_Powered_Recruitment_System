package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.request.AssessmentRequest;
import com.project.ai_resumerag_be.dto.request.ManualGradeRequest;
import com.project.ai_resumerag_be.dto.response.AssessmentResponse;
import com.project.ai_resumerag_be.dto.response.BulkAssignResponse;
import com.project.ai_resumerag_be.dto.response.AttemptResponse;
import com.project.ai_resumerag_be.entity.*;
import com.project.ai_resumerag_be.enumerators.AssessmentStatus;
import com.project.ai_resumerag_be.enumerators.AttemptStatus;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import com.project.ai_resumerag_be.enumerators.Role;
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
    public List<AssessmentResponse> list(UUID jobId) {
        UUID companyId = currentCompanyId();
        List<Assessment> assessments = jobId == null
                ? assessmentRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
                : assessmentRepository.findByCompanyIdAndJobIdOrderByCreatedAtDesc(companyId, jobId);
        return assessments.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AssessmentResponse get(UUID id) {
        return toResponse(findOwned(id));
    }

    public AssessmentResponse create(AssessmentRequest request) {
        User user = currentUser();
        List<RoundDraft> drafts = buildDrafts(request.getRounds());
        Assessment assessment = Assessment.builder()
                .title(request.getTitle().trim())
                .type(request.getType())
                .duration(totalMinutes(drafts))
                .about(blankToNull(request.getAbout()))
                .termsAndConditions(blankToNull(request.getTermsAndConditions()))
                .status(request.getStatus() != null ? request.getStatus() : AssessmentStatus.ACTIVE)
                .company(user.getCompany())
                .job(resolveJob(request.getJobId()))
                .createdBy(user)
                .build();
        assessmentRepository.saveAndFlush(assessment);
        applyDrafts(assessment, drafts);
        return toResponse(assessment);
    }

    public AssessmentResponse update(UUID id, AssessmentRequest request) {
        Assessment assessment = findOwned(id);
        List<RoundDraft> drafts = buildDrafts(request.getRounds());
        boolean same = sameStructure(assessment, drafts);

        if (!same && hasAttempts(assessment.getId())) {
            throw new ConflictException("Rounds, time limits and questions cannot be changed once the assessment was sent to candidates");
        }

        assessment.setTitle(request.getTitle().trim());
        assessment.setType(request.getType());
        assessment.setAbout(blankToNull(request.getAbout()));
        assessment.setTermsAndConditions(blankToNull(request.getTermsAndConditions()));
        assessment.setJob(resolveJob(request.getJobId()));
        if (request.getStatus() != null) {
            assessment.setStatus(request.getStatus());
        }

        if (!same) {
            assessment.setDuration(totalMinutes(drafts));
            replaceStructure(assessment, drafts);
        } else if (assessment.getRounds().isEmpty()) {
            // Created before rounds existed: keep the questions (attempts may point at them) and give them real rounds.
            adoptExistingQuestions(assessment, drafts);
        } else {
            // Same limits and questions, so only the round names and descriptions can differ.
            for (int i = 0; i < drafts.size(); i++) {
                AssessmentRound round = assessment.getRounds().get(i);
                round.setTitle(drafts.get(i).title());
                round.setDescription(drafts.get(i).description());
            }
        }
        return toResponse(assessmentRepository.save(assessment));
    }

    /** Deletes the assessment together with every attempt (and answer) made on it. */
    public void delete(UUID id) {
        Assessment assessment = findOwned(id);
        attemptRepository.deleteByAssessmentId(assessment.getId());
        attemptRepository.flush();
        // Questions point at rounds, so they have to go first.
        assessment.getQuestions().clear();
        assessmentRepository.flush();
        assessmentRepository.delete(assessment);
    }

    // -- attempts --------------------------------------------------------------

    /** Sends the assessment to a candidate; the response carries the link in case email is not configured. */
    public AttemptResponse assign(UUID assessmentId, UUID candidateId) {
        Assessment assessment = findAssignable(assessmentId);
        Candidate candidate = candidateService.requireOwnedCandidate(candidateId);

        if (hasOpenAttempt(assessmentId, candidateId)) {
            throw new ConflictException("This assessment is already assigned to the candidate and not yet finished");
        }
        return createAttempt(assessment, candidate);
    }

    /**
     * Sends the assessment to many candidates at once. A candidate who cannot be sent it (already has it open, or is
     * not found) is skipped with a reason instead of failing the whole batch.
     */
    public BulkAssignResponse assignMany(UUID assessmentId, List<UUID> candidateIds) {
        Assessment assessment = findAssignable(assessmentId);
        Set<UUID> open = candidatesWithOpenAttempt(assessmentId);

        List<AttemptResponse> sent = new ArrayList<>();
        List<BulkAssignResponse.Skipped> skipped = new ArrayList<>();
        for (UUID candidateId : new LinkedHashSet<>(candidateIds)) {
            Candidate candidate;
            try {
                candidate = candidateService.requireOwnedCandidate(candidateId);
            } catch (ResourceNotFoundException e) {
                skipped.add(BulkAssignResponse.Skipped.builder().candidateId(candidateId).reason("Candidate not found").build());
                continue;
            }
            if (open.contains(candidate.getId())) {
                skipped.add(BulkAssignResponse.Skipped.builder().candidateId(candidate.getId())
                        .candidateName(candidate.getCandidateName())
                        .reason("Already has this assessment and has not finished it").build());
                continue;
            }
            sent.add(createAttempt(assessment, candidate));
            open.add(candidate.getId());
        }
        return BulkAssignResponse.builder().sent(sent).skipped(skipped).build();
    }

    private Assessment findAssignable(UUID assessmentId) {
        Assessment assessment = findOwned(assessmentId);
        if (assessment.getStatus() != AssessmentStatus.ACTIVE) {
            throw new BadRequestException("Only active assessments can be assigned");
        }
        return assessment;
    }

    private AttemptResponse createAttempt(Assessment assessment, Candidate candidate) {
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
                .filter(a -> canAccessJob(a.getCandidate().getJob()))
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

    /** Candidates who were sent this assessment and have neither finished it nor let the link run out. */
    private Set<UUID> candidatesWithOpenAttempt(UUID assessmentId) {
        LocalDateTime now = LocalDateTime.now();
        Set<UUID> open = new HashSet<>();
        for (AssessmentAttempt a : attemptRepository.findByAssessmentCompanyIdOrderByCreatedAtDesc(currentCompanyId())) {
            if (!a.getAssessment().getId().equals(assessmentId)) {
                continue;
            }
            AttemptStatus s = AttemptRules.effectiveStatus(a, now);
            if (s == AttemptStatus.ASSIGNED || s == AttemptStatus.IN_PROGRESS) {
                open.add(a.getCandidate().getId());
            }
        }
        return open;
    }

    private boolean hasAttempts(UUID assessmentId) {
        return attemptRepository.existsByAssessmentId(assessmentId);
    }

    /** Validates the rounds and turns them into unsaved entities; nothing touches the database yet. */
    private List<RoundDraft> buildDrafts(List<AssessmentRequest.RoundRequest> rounds) {
        List<RoundDraft> drafts = new ArrayList<>();
        int totalQuestions = 0;
        for (int i = 0; i < rounds.size(); i++) {
            AssessmentRequest.RoundRequest r = rounds.get(i);
            List<AssessmentQuestion> questions = buildQuestions(r.getQuestions(), "Round " + (i + 1) + ": ");
            totalQuestions += questions.size();
            drafts.add(new RoundDraft(r.getTitle().trim(), blankToNull(r.getDescription()), r.getDurationMinutes(), questions));
        }
        if (totalQuestions > AssessmentRequest.MAX_QUESTIONS) {
            throw new BadRequestException("An assessment can have at most " + AssessmentRequest.MAX_QUESTIONS + " questions in total");
        }
        return drafts;
    }

    private List<AssessmentQuestion> buildQuestions(List<AssessmentRequest.QuestionRequest> requests, String where) {
        List<AssessmentQuestion> questions = new ArrayList<>();
        int number = 0;
        for (AssessmentRequest.QuestionRequest r : requests) {
            number++;
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
                    throw new BadRequestException(where + "multiple choice question " + number + " needs at least two distinct options");
                }
                if (!options.contains(correct)) {
                    throw new BadRequestException(where + "multiple choice question " + number + " needs a correct answer that is one of its options");
                }
            }
            questions.add(AssessmentQuestion.builder()
                    .question(r.getQuestion().trim())
                    .type(r.getType())
                    .options(options)
                    .correctAnswer(correct)
                    .weight(r.getWeight())
                    .build());
        }
        return questions;
    }

    private static int totalMinutes(List<RoundDraft> drafts) {
        return drafts.stream().mapToInt(RoundDraft::durationMinutes).sum();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Same number of rounds, same time limits, same questions in the same order. */
    private static boolean sameStructure(Assessment assessment, List<RoundDraft> drafts) {
        List<AssessmentRound> current = assessment.effectiveRounds();
        if (current.size() != drafts.size()) {
            return false;
        }
        for (int i = 0; i < current.size(); i++) {
            if (!current.get(i).getDurationMinutes().equals(drafts.get(i).durationMinutes())
                    || !sameQuestions(assessment.questionsOf(current.get(i)), drafts.get(i).questions())) {
                return false;
            }
        }
        return true;
    }

    /** Throws away the current rounds and questions and stores the new ones. Only valid when nothing refers to them. */
    private void replaceStructure(Assessment assessment, List<RoundDraft> drafts) {
        // Separate flushes: questions reference rounds, so they must be deleted first (and inserted last).
        assessment.getQuestions().clear();
        assessmentRepository.saveAndFlush(assessment);
        assessment.getRounds().clear();
        assessmentRepository.saveAndFlush(assessment);
        applyDrafts(assessment, drafts);
    }

    /** Stores the drafts as rounds, then their questions, numbering questions across the whole assessment. */
    private void applyDrafts(Assessment assessment, List<RoundDraft> drafts) {
        for (int i = 0; i < drafts.size(); i++) {
            RoundDraft d = drafts.get(i);
            assessment.getRounds().add(AssessmentRound.builder()
                    .assessment(assessment).position(i).title(d.title()).description(d.description())
                    .durationMinutes(d.durationMinutes()).build());
        }
        // Rounds first, so the questions can point at stored rounds.
        assessmentRepository.saveAndFlush(assessment);

        int position = 0;
        for (int i = 0; i < drafts.size(); i++) {
            AssessmentRound round = assessment.getRounds().get(i);
            for (AssessmentQuestion question : drafts.get(i).questions()) {
                question.setAssessment(assessment);
                question.setRound(round);
                question.setPosition(position++);
                assessment.getQuestions().add(question);
            }
        }
        assessmentRepository.save(assessment);
    }

    /** Gives an assessment from before rounds existed real rounds, keeping its existing question rows. */
    private void adoptExistingQuestions(Assessment assessment, List<RoundDraft> drafts) {
        for (int i = 0; i < drafts.size(); i++) {
            RoundDraft d = drafts.get(i);
            assessment.getRounds().add(AssessmentRound.builder()
                    .assessment(assessment).position(i).title(d.title()).description(d.description())
                    .durationMinutes(d.durationMinutes()).build());
        }
        assessmentRepository.saveAndFlush(assessment);

        int next = 0;
        for (int i = 0; i < drafts.size(); i++) {
            for (int k = 0; k < drafts.get(i).questions().size(); k++) {
                assessment.getQuestions().get(next++).setRound(assessment.getRounds().get(i));
            }
        }
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

    /** The job must belong to the caller's company (and be accessible to them); null means "not tied to a job". */
    private Job resolveJob(UUID jobId) {
        return jobId == null ? null : candidateService.requireOwnedJob(jobId);
    }

    private Assessment findOwned(UUID id) {
        return assessmentRepository.findByIdAndCompanyId(id, currentCompanyId())
                .orElseThrow(() -> new ResourceNotFoundException("Assessment not found with id: " + id));
    }

    private AssessmentAttempt findOwnedAttempt(UUID id) {
        return attemptRepository.findByIdAndAssessmentCompanyId(id, currentCompanyId())
                .filter(a -> canAccessJob(a.getCandidate().getJob()))
                .orElseThrow(() -> new ResourceNotFoundException("Assessment attempt not found with id: " + id));
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

    private AssessmentResponse toResponse(Assessment a) {
        return AssessmentResponse.builder()
                .id(a.getId())
                .title(a.getTitle())
                .type(a.getType())
                .duration(a.getDuration())
                .status(a.getStatus())
                .jobId(a.getJob() != null ? a.getJob().getId() : null)
                .jobTitle(a.getJob() != null ? a.getJob().getTitle() : null)
                .about(a.getAbout())
                .termsAndConditions(a.getTermsAndConditions())
                .createdAt(a.getCreatedAt())
                .rounds(a.effectiveRounds().stream().map(r -> AssessmentResponse.Round.builder()
                        .id(r.getId())
                        .title(r.getTitle())
                        .description(r.getDescription())
                        .durationMinutes(r.getDurationMinutes())
                        .questions(a.questionsOf(r).stream().map(this::toQuestion).toList())
                        .build()).toList())
                .questions(a.getQuestions().stream().map(this::toQuestion).toList())
                .build();
    }

    private AssessmentResponse.Question toQuestion(AssessmentQuestion q) {
        return AssessmentResponse.Question.builder()
                .id(q.getId())
                .question(q.getQuestion())
                .type(q.getType())
                .options(new ArrayList<>(q.getOptions()))
                .correctAnswer(q.getCorrectAnswer())
                .weight(q.getWeight())
                .build();
    }

    private record RoundDraft(String title, String description, int durationMinutes, List<AssessmentQuestion> questions) {
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
                                .roundTitle(x.getQuestion().getRound() != null ? x.getQuestion().getRound().getTitle() : null)
                                .options(new ArrayList<>(x.getQuestion().getOptions()))
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
