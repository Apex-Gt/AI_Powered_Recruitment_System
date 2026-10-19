package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.ai.GradeResult;
import com.project.ai_resumerag_be.dto.request.SubmitAssessmentRequest;
import com.project.ai_resumerag_be.dto.response.PublicAssessmentResponse;
import com.project.ai_resumerag_be.entity.AssessmentAttempt;
import com.project.ai_resumerag_be.entity.Assessment;
import com.project.ai_resumerag_be.entity.AssessmentQuestion;
import com.project.ai_resumerag_be.entity.AssessmentRound;
import com.project.ai_resumerag_be.entity.AttemptAnswer;
import com.project.ai_resumerag_be.enumerators.AttemptStatus;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ConflictException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.AssessmentAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Candidate side of assessments. Everything is reached through the secret token from the invite email,
 * so a wrong or unknown token is always the same "not found".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicAssessmentService {

    private static final int MAX_ANSWER_CHARS = 50_000;

    private final AssessmentAttemptRepository attemptRepository;
    private final AIServiceClient aiServiceClient;
    private final TransactionTemplate transaction;

    public PublicAssessmentResponse preview(String token) {
        return transaction.execute(status -> toResponse(find(token), false));
    }

    /**
     * Begins the assessment (the first call, which needs the terms accepted) or the next round (once the previous one
     * was submitted), starting that round's clock. Calling it again while a round is running just returns its
     * questions again.
     */
    public PublicAssessmentResponse start(String token, boolean acceptedTerms) {
        return transaction.execute(status -> {
            AssessmentAttempt attempt = find(token);
            LocalDateTime now = LocalDateTime.now();
            AttemptStatus effective = AttemptRules.effectiveStatus(attempt, now);
            switch (effective) {
                case ASSIGNED -> {
                    String terms = attempt.getAssessment().getTermsAndConditions();
                    if (terms != null && !terms.isBlank() && !acceptedTerms) {
                        throw new BadRequestException("You need to accept the terms and conditions to start");
                    }
                    attempt.setStatus(AttemptStatus.IN_PROGRESS);
                    attempt.setStartedAt(now);
                    attempt.setTermsAcceptedAt(now);
                    attempt.setCurrentRound(0);
                    attempt.setRoundStartedAt(now);
                    attemptRepository.save(attempt);
                }
                case IN_PROGRESS -> {
                    if (AttemptRules.roundStart(attempt) == null) {
                        attempt.setRoundStartedAt(now);
                        attemptRepository.save(attempt);
                    }
                }
                case EXPIRED -> throw new BadRequestException("This assessment link has expired");
                default -> throw new ConflictException("This assessment was already submitted");
            }
            return toResponse(attempt, true);
        });
    }

    public PublicAssessmentResponse submit(String token, SubmitAssessmentRequest request) {
        List<PendingGrade> pending = transaction.execute(status -> recordAnswers(token, request.getAnswers()));

        // The AI calls can take a while, so they run outside any transaction.
        List<Graded> graded = new ArrayList<>();
        for (PendingGrade p : pending) {
            graded.add(new Graded(p.answerId(), gradeWithAi(p)));
        }

        transaction.executeWithoutResult(status -> {
            AssessmentAttempt attempt = find(token);
            for (Graded g : graded) {
                attempt.getAnswers().stream().filter(a -> a.getId().equals(g.answerId())).findFirst().ifPresent(answer -> {
                    if (g.result() == null) {
                        answer.setNeedsReview(true);
                    } else {
                        answer.setScore(g.result().getScore());
                        answer.setFeedback(g.result().getFeedback());
                        answer.setNeedsReview(false);
                    }
                });
            }
            AttemptRules.recompute(attempt);
            attemptRepository.save(attempt);
        });
        return preview(token);
    }

    // -- internals -------------------------------------------------------------

    private List<PendingGrade> recordAnswers(String token, Map<String, String> submitted) {
        AssessmentAttempt attempt = find(token);
        LocalDateTime now = LocalDateTime.now();
        AttemptStatus effective = AttemptRules.effectiveStatus(attempt, now);
        if (effective == AttemptStatus.EXPIRED) {
            throw new BadRequestException("Time is up: this assessment can no longer be submitted");
        }
        if (effective != AttemptStatus.IN_PROGRESS) {
            throw new ConflictException(effective == AttemptStatus.ASSIGNED
                    ? "Start the assessment before submitting" : "This assessment was already submitted");
        }
        if (AttemptRules.roundStart(attempt) == null) {
            throw new ConflictException("Start the next round before submitting");
        }

        Assessment assessment = attempt.getAssessment();
        int roundIndex = AttemptRules.roundIndex(attempt);
        AssessmentRound round = assessment.effectiveRounds().get(roundIndex);
        List<AttemptAnswer> recorded = new ArrayList<>();
        List<PendingGrade> pending = new ArrayList<>();
        for (AssessmentQuestion question : assessment.questionsOf(round)) {
            String raw = submitted.get(question.getId().toString());
            String text = raw == null ? "" : raw.strip();
            if (text.length() > MAX_ANSWER_CHARS) {
                text = text.substring(0, MAX_ANSWER_CHARS);
            }

            AttemptAnswer answer = AttemptAnswer.builder().attempt(attempt).question(question).answer(text.isEmpty() ? null : text).build();
            switch (question.getType()) {
                case MULTIPLE_CHOICE -> {
                    boolean correct = !text.isEmpty() && text.equalsIgnoreCase(question.getCorrectAnswer().strip());
                    answer.setScore(correct ? 100.0 : 0.0);
                }
                case VIDEO -> {
                    // A link or note a human has to look at; an empty one is simply a zero.
                    if (text.isEmpty()) {
                        answer.setScore(0.0);
                        answer.setFeedback("No answer was provided.");
                    } else {
                        answer.setNeedsReview(true);
                    }
                }
                case CODE, ESSAY -> {
                    if (text.isEmpty()) {
                        answer.setScore(0.0);
                        answer.setFeedback("No answer was provided.");
                    }
                }
            }
            attempt.getAnswers().add(answer);
            recorded.add(answer);
        }

        if (roundIndex >= assessment.effectiveRounds().size() - 1) {
            attempt.setStatus(AttemptStatus.SUBMITTED);
            attempt.setSubmittedAt(now);
        } else {
            // The next round waits for the candidate to start it.
            attempt.setCurrentRound(roundIndex + 1);
            attempt.setRoundStartedAt(null);
        }
        attemptRepository.flush();

        for (AttemptAnswer answer : recorded) {
            QuestionType type = answer.getQuestion().getType();
            if ((type == QuestionType.CODE || type == QuestionType.ESSAY) && answer.getScore() == null) {
                pending.add(new PendingGrade(answer.getId(), answer.getQuestion().getQuestion(), answer.getAnswer(), type.name()));
            }
        }
        // Answers that already carry a score (multiple choice, blanks) may complete the attempt right away
        // (this only does anything once the last round was submitted).
        AttemptRules.recompute(attempt);
        return pending;
    }

    private GradeResult gradeWithAi(PendingGrade p) {
        try {
            var response = aiServiceClient.gradeAnswer(p.question(), p.answer(), p.type()).block(Duration.ofSeconds(100));
            return response == null ? null : response.getData();
        } catch (Exception e) {
            log.warn("AI grading failed for answer {}; leaving it for manual review: {}", p.answerId(), e.getMessage());
            return null;
        }
    }

    private AssessmentAttempt find(String token) {
        return attemptRepository.findByTokenHash(AttemptRules.hash(token))
                .orElseThrow(() -> new ResourceNotFoundException("This assessment link is not valid"));
    }

    private PublicAssessmentResponse toResponse(AssessmentAttempt attempt, boolean withQuestions) {
        LocalDateTime now = LocalDateTime.now();
        AttemptStatus status = AttemptRules.effectiveStatus(attempt, now);
        Assessment assessment = attempt.getAssessment();
        boolean inProgress = status == AttemptStatus.IN_PROGRESS;
        boolean running = inProgress && AttemptRules.roundStart(attempt) != null;
        int roundIndex = AttemptRules.roundIndex(attempt);

        List<PublicAssessmentResponse.Round> rounds = assessment.effectiveRounds().stream()
                .map(r -> PublicAssessmentResponse.Round.builder()
                        .title(r.getTitle())
                        .description(r.getDescription())
                        .durationMinutes(r.getDurationMinutes())
                        .questionCount(assessment.questionsOf(r).size())
                        .build())
                .toList();

        return PublicAssessmentResponse.builder()
                .title(assessment.getTitle())
                .companyName(assessment.getCompany().getCompanyName())
                .candidateName(attempt.getCandidate().getCandidateName())
                .duration(assessment.getDuration())
                .status(status)
                .questionCount(assessment.getQuestions().size())
                .expiresAt(attempt.getExpiresAt())
                .about(assessment.getAbout())
                .termsAndConditions(assessment.getTermsAndConditions())
                .rounds(rounds)
                .currentRound(inProgress ? roundIndex : null)
                .roundRunning(inProgress ? running : null)
                // The countdown is the round's real time limit; the grace period only affects what is still accepted.
                .secondsLeft(running
                        ? Math.max(0, Duration.between(now, AttemptRules.roundEnd(attempt)).getSeconds()) : null)
                .questions(withQuestions && running ? assessment.questionsOf(assessment.effectiveRounds().get(roundIndex)).stream()
                        .map(q -> PublicAssessmentResponse.Question.builder()
                                .id(q.getId())
                                .question(q.getQuestion())
                                .type(q.getType())
                                .options(new ArrayList<>(q.getOptions()))
                                .weight(q.getWeight())
                                .build())
                        .toList() : null)
                .build();
    }

    private record PendingGrade(UUID answerId, String question, String answer, String type) {
    }

    private record Graded(UUID answerId, GradeResult result) {
    }
}
