package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.dto.ai.JobDescription;
import com.project.ai_resumerag_be.enums.AiResultType;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeTaskProcessorTest {

    @Mock TaskStore store;
    @Mock PipelineAiClient ai;
    @Mock AiResultStore aiResults;
    @Mock CandidateService candidateService;
    @Mock FileStorageService fileStorage;
    @Mock com.project.ai_resumerag_be.repository.CandidateRepository candidates;
    @Mock com.project.ai_resumerag_be.service.AIServiceClient aiServiceClient;

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private final PipelineProperties properties = new PipelineProperties();
    private ResumeTaskProcessor processor;

    private final UUID taskId = UUID.randomUUID();
    private final UUID candidateId = UUID.randomUUID();
    private final UUID jobId = UUID.randomUUID();
    private final Map<String, Object> profile = Map.of("name", "Jane", "skills", java.util.List.of());

    @BeforeEach
    void setUp() {
        processor = new ResumeTaskProcessor(store, ai, aiResults, candidateService, fileStorage, properties, mapper, candidates, aiServiceClient);
        lenient().when(fileStorage.getFilePath(anyString())).thenReturn("/data/cv.pdf");
    }

    private ResumeTask task(ResumeTaskStage stage) {
        return ResumeTask.builder().id(taskId).jobId(jobId).candidateId(candidateId).resumeId(UUID.randomUUID())
                .fileName("cv.pdf").fileUrl("resumes/cv.pdf").sha256("s".repeat(64))
                .status(ResumeTaskStatus.PROCESSING).stage(stage)
                .ranking(stage == ResumeTaskStage.INDEX || stage == ResumeTaskStage.SCORE || stage == ResumeTaskStage.SUMMARY)
                .build();
    }

    /** Serves the task in a given stage, then in the next one, and so on, like the database would. */
    private void stages(ResumeTaskStage... sequence) {
        ResumeTask[] tasks = new ResumeTask[sequence.length];
        for (int i = 0; i < sequence.length; i++) {
            tasks[i] = task(sequence[i]);
        }
        var stub = when(store.get(taskId)).thenReturn(tasks[0]);
        for (int i = 1; i < tasks.length; i++) {
            stub = stub.thenReturn(tasks[i]);
        }
    }

    private JobDescription job(String description) {
        return JobDescription.builder().jobId(jobId.toString()).title("Backend").description(description).build();
    }

    @Test
    void stagesRunInOrderAndTheTaskIsCompleted() {
        stages(ResumeTaskStage.EXTRACT, ResumeTaskStage.PERSIST, ResumeTaskStage.PROFILE, ResumeTaskStage.DONE);
        Map<String, Object> extract = Map.of("text", "t");
        when(ai.extract("/data/cv.pdf", "cv.pdf")).thenReturn(extract);
        when(store.persistCandidate(taskId)).thenReturn(TaskStore.PersistOutcome.CREATED);
        when(ai.profile("/data/cv.pdf", "cv.pdf")).thenReturn(Map.of("profile", profile));

        processor.run(taskId);

        InOrder order = inOrder(store, ai);
        order.verify(store).beginStage(taskId);
        order.verify(ai).extract("/data/cv.pdf", "cv.pdf");
        order.verify(store).saveExtract(taskId, extract);
        order.verify(store).persistCandidate(taskId);
        order.verify(ai).profile("/data/cv.pdf", "cv.pdf");
        order.verify(store).saveProfile(eq(taskId), any());
        order.verify(store).complete(taskId);
    }

    @Test
    void anUploadStopsAfterTheProfileAndLeavesRankingForLater() {
        ResumeTask upload = task(ResumeTaskStage.INDEX);
        upload.setRanking(false);
        when(store.get(taskId)).thenReturn(upload);

        processor.run(taskId);

        verify(store).complete(taskId);
        verify(ai, never()).index(any(), any(), any(), any(), any());
        verify(ai, never()).score(any(), any(), any(), any());
    }

    @Test
    void aTaskCancelledMidStageDropsItsResultAndRemovesVectorsOfARemovedCandidate() {
        doThrow(new TaskNoLongerRunning(taskId)).when(store).markIndexed(taskId);
        when(store.get(taskId)).thenReturn(task(ResumeTaskStage.INDEX));
        when(candidates.existsById(candidateId)).thenReturn(false);
        when(aiServiceClient.deleteCandidate(candidateId)).thenReturn(reactor.core.publisher.Mono.empty());

        processor.run(taskId);

        verify(aiServiceClient).deleteCandidate(candidateId);
        verify(store, never()).recordFailure(any(), any());
        verify(store, never()).complete(any());
    }

    @Test
    void interruptingATaskThatIsNotRunningHereDoesNothing() {
        processor.interrupt(UUID.randomUUID());
        assertFalse(Thread.currentThread().isInterrupted());
    }

    @Test
    void aDuplicateApplicantStopsThePipelineBeforeAnyAiWork() {
        stages(ResumeTaskStage.PERSIST);
        when(store.persistCandidate(taskId)).thenReturn(TaskStore.PersistOutcome.DUPLICATE);

        processor.run(taskId);

        verify(ai, never()).profile(any(), any());
        verify(store, never()).complete(any());
        verify(store, never()).recordFailure(any(), any());
    }

    @Test
    void aStageFailureIsRecordedAndNothingElseRuns() {
        stages(ResumeTaskStage.PROFILE);
        when(ai.profile(any(), any())).thenThrow(StageFailure.transientFailure("LLM_UNAVAILABLE", "ollama down"));

        processor.run(taskId);

        verify(store).recordFailure(eq(taskId), argThat(f -> f.kind() == StageFailure.Kind.TRANSIENT && f.code().equals("LLM_UNAVAILABLE")));
        verify(store, never()).saveProfile(any(), any());
        verify(store, never()).complete(any());
    }

    @Test
    void anUnexpectedErrorIsCountedAsATransientFailureNotSwallowed() {
        stages(ResumeTaskStage.INDEX);
        when(ai.index(any(), any(), any(), any(), any())).thenThrow(new IllegalStateException("boom"));

        processor.run(taskId);

        verify(store).recordFailure(eq(taskId), argThat(f -> f.kind() == StageFailure.Kind.TRANSIENT && f.code().equals("INTERNAL_ERROR")));
        verify(store, never()).complete(any());
    }

    @Test
    void aTaskThatIsNoLongerProcessingIsLeftAlone() {
        ResumeTask done = task(ResumeTaskStage.SCORE);
        done.setStatus(ResumeTaskStatus.QUEUED);
        when(store.get(taskId)).thenReturn(done);
        processor.run(taskId);
        verify(ai, never()).score(any(), any(), any(), any());
        verify(store, never()).beginStage(any());
    }

    @Test
    void anUnchangedScoreIsNotRecomputed() {
        JobDescription job = job("Python services");
        ResumeTask t = task(ResumeTaskStage.SCORE);
        t.setScoreKey(processor.analysisKey(t, job, false));
        when(store.get(taskId)).thenReturn(t, task(ResumeTaskStage.DONE));
        when(candidateService.getJobDescription(jobId)).thenReturn(job);
        when(aiResults.find(AiResultType.MATCH_SCORE, candidateId, jobId)).thenReturn(Optional.of(Map.of("overallScore", 80)));

        processor.run(taskId);

        verify(ai, never()).score(any(), any(), any(), any());
        verify(store).skipScore(taskId);
    }

    @Test
    void aChangedJobDescriptionForcesANewScoreAndSummary() {
        ResumeTask t = task(ResumeTaskStage.SCORE);
        String before = processor.analysisKey(t, job("Python services"), false);
        String after = processor.analysisKey(t, job("Rust services"), false);
        assertNotEquals(before, after);

        // The summary key also depends on the model, the score key does not.
        assertNotEquals(processor.analysisKey(t, job("x"), true), processor.analysisKey(t, job("x"), false));
        properties.setModelTag("qwen3:8b");
        assertNotEquals(processor.analysisKey(t, job("x"), true), new ResumeTaskProcessor(store, ai, aiResults, candidateService, fileStorage, new PipelineProperties(), mapper, candidates, aiServiceClient).analysisKey(t, job("x"), true));
    }

    @Test
    void aStoredScoreIsRecomputedWhenItsResultIsMissingEvenIfTheKeyMatches() {
        JobDescription job = job("Python services");
        ResumeTask t = task(ResumeTaskStage.SCORE);
        t.setScoreKey(processor.analysisKey(t, job, false));
        when(store.get(taskId)).thenReturn(t, task(ResumeTaskStage.DONE));
        when(candidateService.getJobDescription(jobId)).thenReturn(job);
        when(aiResults.find(AiResultType.MATCH_SCORE, candidateId, jobId)).thenReturn(Optional.empty());
        when(aiResults.find(AiResultType.PROFILE, candidateId, null)).thenReturn(Optional.of(profile));
        when(ai.score(eq(candidateId), anyString(), eq(job), eq(profile))).thenReturn(Map.of("matchScore", Map.of()));

        processor.run(taskId);

        verify(ai).score(eq(candidateId), anyString(), eq(job), eq(profile));
        verify(store).saveScore(eq(taskId), any(), anyString());
        assertEquals(1, mockingDetails(ai).getInvocations().stream().filter(i -> i.getMethod().getName().equals("score")).count());
    }
}
