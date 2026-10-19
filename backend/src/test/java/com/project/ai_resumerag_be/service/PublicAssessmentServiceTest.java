package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.ai.AIServiceResponse;
import com.project.ai_resumerag_be.dto.ai.GradeResult;
import com.project.ai_resumerag_be.dto.request.SubmitAssessmentRequest;
import com.project.ai_resumerag_be.dto.response.PublicAssessmentResponse;
import com.project.ai_resumerag_be.entity.*;
import com.project.ai_resumerag_be.enumerators.AttemptStatus;
import com.project.ai_resumerag_be.enumerators.QuestionType;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ConflictException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.AssessmentAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PublicAssessmentServiceTest {

    private static final String TOKEN = "secret-token";

    @Mock AssessmentAttemptRepository attemptRepository;
    @Mock AIServiceClient aiServiceClient;

    private PublicAssessmentService service;
    private AssessmentAttempt attempt;
    private AssessmentQuestion mcq;
    private AssessmentQuestion code;

    @BeforeEach
    void setUp() {
        PlatformTransactionManager noOp = new PlatformTransactionManager() {
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            public void commit(TransactionStatus status) {
            }

            public void rollback(TransactionStatus status) {
            }
        };
        service = new PublicAssessmentService(attemptRepository, aiServiceClient, new TransactionTemplate(noOp));

        Company company = Company.builder().id(UUID.randomUUID()).companyName("Acme").build();
        Assessment assessment = Assessment.builder().id(UUID.randomUUID()).title("Java quiz").duration(30).company(company).build();
        mcq = AssessmentQuestion.builder().id(UUID.randomUUID()).assessment(assessment).position(0).type(QuestionType.MULTIPLE_CHOICE)
                .question("2+2?").options(List.of("3", "4")).correctAnswer("4").weight(10).build();
        code = AssessmentQuestion.builder().id(UUID.randomUUID()).assessment(assessment).position(1).type(QuestionType.CODE)
                .question("Reverse a string").weight(30).build();
        assessment.setQuestions(new ArrayList<>(List.of(mcq, code)));

        Candidate candidate = Candidate.builder().id(UUID.randomUUID()).candidateName("Cam").build();
        attempt = AssessmentAttempt.builder().id(UUID.randomUUID()).assessment(assessment).candidate(candidate)
                .status(AttemptStatus.ASSIGNED).expiresAt(LocalDateTime.now().plusDays(3)).answers(new ArrayList<>()).build();

        lenient().when(attemptRepository.findByTokenHash(AttemptRules.hash(TOKEN))).thenReturn(Optional.of(attempt));
        lenient().when(attemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // Persisting assigns ids to the new answers, as the real flush would.
        lenient().doAnswer(inv -> {
            attempt.getAnswers().stream().filter(a -> a.getId() == null).forEach(a -> a.setId(UUID.randomUUID()));
            return null;
        }).when(attemptRepository).flush();
    }

    private void started() {
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setStartedAt(LocalDateTime.now().minusMinutes(5));
    }

    private SubmitAssessmentRequest answers(String mcqAnswer, String codeAnswer) {
        return new SubmitAssessmentRequest(Map.of(mcq.getId().toString(), mcqAnswer, code.getId().toString(), codeAnswer));
    }

    private AttemptAnswer answerFor(AssessmentQuestion q) {
        return attempt.getAnswers().stream().filter(a -> a.getQuestion() == q).findFirst().orElseThrow();
    }

    @Test
    void unknownTokenIsNotFound() {
        assertThrows(ResourceNotFoundException.class, () -> service.preview("nope"));
    }

    @Test
    void previewNeverExposesQuestionsOrAnswers() {
        PublicAssessmentResponse response = service.preview(TOKEN);
        assertEquals(2, response.getQuestionCount());
        assertNull(response.getQuestions());
        assertEquals(AttemptStatus.ASSIGNED, response.getStatus());
    }

    @Test
    void startBeginsTheClockOnceAndHidesCorrectAnswers() {
        PublicAssessmentResponse first = service.start(TOKEN, true);
        LocalDateTime startedAt = attempt.getStartedAt();
        assertNotNull(startedAt);
        assertEquals(2, first.getQuestions().size());
        // The countdown is the configured limit, without the grace period
        assertTrue(first.getSecondsLeft() > (30 - 1) * 60 && first.getSecondsLeft() <= 30 * 60);

        service.start(TOKEN, true);
        assertEquals(startedAt, attempt.getStartedAt());
    }

    @Test
    void expiredLinkCannotBeStarted() {
        attempt.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        assertThrows(BadRequestException.class, () -> service.start(TOKEN, true));
    }

    @Test
    void submitScoresMultipleChoiceAndUsesAiForCode() {
        started();
        when(aiServiceClient.gradeAnswer(eq("Reverse a string"), eq("s[::-1]"), eq("CODE")))
                .thenReturn(Mono.just(new AIServiceResponse<>("success", "ok", new GradeResult(80, "Good"))));

        service.submit(TOKEN, answers("4", "s[::-1]"));

        assertEquals(100.0, answerFor(mcq).getScore());
        assertEquals(80.0, answerFor(code).getScore());
        assertEquals("Good", answerFor(code).getFeedback());
        assertEquals(AttemptStatus.GRADED, attempt.getStatus());
        // (100*10 + 80*30) / 40
        assertEquals(85.0, attempt.getTotalScore());
        assertNotNull(attempt.getSubmittedAt());
    }

    @Test
    void multipleChoiceMatchIgnoresCaseAndWhitespace() {
        mcq.setOptions(List.of("Yes", "No"));
        mcq.setCorrectAnswer("Yes");
        started();
        when(aiServiceClient.gradeAnswer(any(), any(), any()))
                .thenReturn(Mono.just(new AIServiceResponse<>("success", "ok", new GradeResult(50, "ok"))));

        service.submit(TOKEN, answers("  yes ", "x"));

        assertEquals(100.0, answerFor(mcq).getScore());
    }

    @Test
    void aiFailureLeavesAnswerForManualReviewWithoutFailingTheSubmission() {
        started();
        when(aiServiceClient.gradeAnswer(any(), any(), any())).thenReturn(Mono.error(new RuntimeException("AI down")));

        service.submit(TOKEN, answers("3", "whatever"));

        assertEquals(0.0, answerFor(mcq).getScore());
        assertNull(answerFor(code).getScore());
        assertTrue(answerFor(code).isNeedsReview());
        assertEquals(AttemptStatus.SUBMITTED, attempt.getStatus());
        assertNull(attempt.getTotalScore());
    }

    @Test
    void blankCodeAnswerScoresZeroWithoutCallingTheAi() {
        started();

        service.submit(TOKEN, answers("4", "   "));

        assertEquals(0.0, answerFor(code).getScore());
        verifyNoInteractions(aiServiceClient);
        assertEquals(AttemptStatus.GRADED, attempt.getStatus());
        assertEquals(25.0, attempt.getTotalScore());
    }

    @Test
    void cannotSubmitTwiceBeforeStartingOrAfterTimeIsUp() {
        assertThrows(ConflictException.class, () -> service.submit(TOKEN, answers("4", "x")));

        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setStartedAt(LocalDateTime.now().minusMinutes(30 + AttemptRules.GRACE_MINUTES + 1));
        assertThrows(BadRequestException.class, () -> service.submit(TOKEN, answers("4", "x")));

        attempt.setStatus(AttemptStatus.GRADED);
        assertThrows(ConflictException.class, () -> service.submit(TOKEN, answers("4", "x")));
        verifyNoInteractions(aiServiceClient);
    }

    /** Splits the two questions into round 1 (mcq, 10 min) and round 2 (code, 20 min). */
    private void twoRounds() {
        Assessment assessment = attempt.getAssessment();
        AssessmentRound first = AssessmentRound.builder().id(UUID.randomUUID()).assessment(assessment).position(0)
                .title("Basics").description("Warm up").durationMinutes(10).build();
        AssessmentRound second = AssessmentRound.builder().id(UUID.randomUUID()).assessment(assessment).position(1)
                .title("Coding").durationMinutes(20).build();
        assessment.setRounds(new ArrayList<>(List.of(first, second)));
        assessment.setDuration(30);
        mcq.setRound(first);
        code.setRound(second);
    }

    @Test
    void termsMustBeAcceptedBeforeStarting() {
        attempt.getAssessment().setTermsAndConditions("No outside help.");

        assertThrows(BadRequestException.class, () -> service.start(TOKEN, false));
        assertEquals(AttemptStatus.ASSIGNED, attempt.getStatus());

        service.start(TOKEN, true);
        assertEquals(AttemptStatus.IN_PROGRESS, attempt.getStatus());
        assertNotNull(attempt.getTermsAcceptedAt());
    }

    @Test
    void previewListsEveryRoundButNoQuestions() {
        twoRounds();
        PublicAssessmentResponse response = service.preview(TOKEN);

        assertEquals(2, response.getRounds().size());
        assertEquals("Basics", response.getRounds().get(0).getTitle());
        assertEquals("Warm up", response.getRounds().get(0).getDescription());
        assertEquals(10, response.getRounds().get(0).getDurationMinutes());
        assertEquals(1, response.getRounds().get(1).getQuestionCount());
        assertNull(response.getQuestions());
    }

    @Test
    void roundsAreTakenOneAtATimeEachWithItsOwnClock() {
        twoRounds();
        when(aiServiceClient.gradeAnswer(any(), any(), any()))
                .thenReturn(Mono.just(new AIServiceResponse<>("success", "ok", new GradeResult(60, "ok"))));

        PublicAssessmentResponse first = service.start(TOKEN, true);
        assertEquals(1, first.getQuestions().size());
        assertEquals(mcq.getId(), first.getQuestions().get(0).getId());
        assertTrue(first.getSecondsLeft() > 9 * 60 && first.getSecondsLeft() <= 10 * 60);

        PublicAssessmentResponse between = service.submit(TOKEN, answers("4", "ignored"));
        assertEquals(AttemptStatus.IN_PROGRESS, between.getStatus());
        assertEquals(1, between.getCurrentRound());
        assertFalse(between.getRoundRunning());
        assertNull(between.getQuestions());
        assertEquals(1, attempt.getAnswers().size());
        assertNull(attempt.getTotalScore());

        // The next round has not been started, so it cannot be submitted yet.
        assertThrows(ConflictException.class, () -> service.submit(TOKEN, answers("4", "x")));

        PublicAssessmentResponse second = service.start(TOKEN, false);
        assertEquals(code.getId(), second.getQuestions().get(0).getId());
        assertTrue(second.getRoundRunning());
        assertTrue(second.getSecondsLeft() > 19 * 60 && second.getSecondsLeft() <= 20 * 60);

        service.submit(TOKEN, answers("4", "s[::-1]"));
        assertEquals(AttemptStatus.GRADED, attempt.getStatus());
        assertEquals(2, attempt.getAnswers().size());
        // (100*10 + 60*30) / 40
        assertEquals(70.0, attempt.getTotalScore());
        assertNotNull(attempt.getSubmittedAt());
    }

    @Test
    void aRoundThatRanOutOfTimeExpiresTheAttempt() {
        twoRounds();
        service.start(TOKEN, true);
        attempt.setRoundStartedAt(LocalDateTime.now().minusMinutes(10 + AttemptRules.GRACE_MINUTES + 1));

        assertThrows(BadRequestException.class, () -> service.submit(TOKEN, answers("4", "x")));
        assertEquals(AttemptStatus.EXPIRED, service.preview(TOKEN).getStatus());
    }

    @Test
    void timeBetweenRoundsDoesNotCountAgainstTheNextRound() {
        twoRounds();
        service.start(TOKEN, true);
        // Round 1 was started long ago but submitted; the candidate only starts round 2 now.
        attempt.setStartedAt(LocalDateTime.now().minusHours(2));
        attempt.setCurrentRound(1);
        attempt.setRoundStartedAt(null);

        PublicAssessmentResponse second = service.start(TOKEN, false);
        assertEquals(AttemptStatus.IN_PROGRESS, second.getStatus());
        assertTrue(second.getSecondsLeft() > 19 * 60);
    }

    @Test
    void tokensAreUniqueAndOnlyTheirHashIsComparable() {
        String a = AttemptRules.newToken();
        String b = AttemptRules.newToken();
        assertNotEquals(a, b);
        assertTrue(a.length() >= 43);
        assertEquals(64, AttemptRules.hash(a).length());
        assertNotEquals(a, AttemptRules.hash(a));
    }
}
