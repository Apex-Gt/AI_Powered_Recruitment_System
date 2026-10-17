package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.ai.GradeResult;
import com.project.ai_resumerag_be.dto.request.SubmitAssessmentRequest;
import com.project.ai_resumerag_be.dto.response.PublicAssessmentResponse;
import com.project.ai_resumerag_be.entity.AssessmentAttempt;
import com.project.ai_resumerag_be.entity.AssessmentQuestion;
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

    /** Starts the clock (once) and returns the questions. Calling it again while running just returns them again. */
    public PublicAssessmentResponse start(String token) {
        return transaction.execute(status -> {
            AssessmentAttempt attempt = find(token);
            AttemptStatus effective = AttemptRules.effectiveStatus(attempt, LocalDateTime.now());
            switch (effective) {
                case ASSIGNED -> {
                    attempt.setStatus(AttemptStatus.IN_PROGRESS);
                    attempt.setStartedAt(LocalDateTime.now());
                    attemptRepository.save(attempt);
                }
                case IN_PROGRESS -> {
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

        List<PendingGrade> pending = new ArrayList<>();
        for (AssessmentQuestion question : attempt.getAssessment().getQuestions()) {
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
        }

        attempt.setStatus(AttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(now);
        attemptRepository.flush();

        for (AttemptAnswer answer : attempt.getAnswers()) {
            QuestionType type = answer.getQuestion().getType();
            if ((type == QuestionType.CODE || type == QuestionType.ESSAY) && answer.getScore() == null) {
                pending.add(new PendingGrade(answer.getId(), answer.getQuestion().getQuestion(), answer.getAnswer(), type.name()));
            }
        }
        // Answers that already carry a score (multiple choice, blanks) may complete the attempt right away.
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
        AttemptStatus status = AttemptRules.effectiveStatus(attempt, LocalDateTime.now());
        List<AssessmentQuestion> questions = attempt.getAssessment().getQuestions();
        return PublicAssessmentResponse.builder()
                .title(attempt.getAssessment().getTitle())
                .companyName(attempt.getAssessment().getCompany().getCompanyName())
                .candidateName(attempt.getCandidate().getCandidateName())
                .duration(attempt.getAssessment().getDuration())
                .status(status)
                .questionCount(questions.size())
                .expiresAt(attempt.getExpiresAt())
                .secondsLeft(status == AttemptStatus.IN_PROGRESS
                        ? Math.max(0, Duration.between(LocalDateTime.now(), AttemptRules.deadline(attempt)).getSeconds()) : null)
                .questions(withQuestions && status == AttemptStatus.IN_PROGRESS ? questions.stream()
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
