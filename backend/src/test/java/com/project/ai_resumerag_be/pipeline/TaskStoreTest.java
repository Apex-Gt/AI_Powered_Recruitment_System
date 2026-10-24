package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.Resume;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.JobRepository;
import com.project.ai_resumerag_be.repository.ResumeRepository;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.FileStorageService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskStoreTest {

    @Mock ResumeTaskRepository tasks;
    @Mock ResumeBatchRepository batches;
    @Mock CandidateRepository candidates;
    @Mock ResumeRepository resumes;
    @Mock JobRepository jobs;
    @Mock AiResultStore aiResults;
    @Mock FileStorageService fileStorage;
    @Mock EntityManager em;
    @Mock Query advisoryLock;

    private final PipelineProperties properties = new PipelineProperties();
    private final ObjectMapper mapper = JsonMapper.builder().build();
    private TaskStore store;

    private final UUID jobId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        store = new TaskStore(tasks, batches, candidates, resumes, jobs, aiResults, fileStorage, properties, mapper);
        ReflectionTestUtils.setField(store, "em", em);
    }

    private ResumeTask task(ResumeTaskStage stage, int stageAttempts) {
        ResumeTask t = ResumeTask.builder()
                .id(UUID.randomUUID()).batchId(UUID.randomUUID()).jobId(jobId).companyId(UUID.randomUUID())
                .fileName("cv.pdf").fileUrl("resumes/x/cv.pdf").sha256("a".repeat(64)).dedupeKey(jobId + ":" + "a".repeat(64))
                .status(ResumeTaskStatus.PROCESSING).stage(stage).stageAttempts(stageAttempts).totalAttempts(stageAttempts)
                .nextAttemptAt(LocalDateTime.now()).lockedBy("w1").lockedUntil(LocalDateTime.now().plusMinutes(5))
                .build();
        lenient().when(tasks.findById(t.getId())).thenReturn(Optional.of(t));
        return t;
    }

    // ------------------------------------------------------------- retries

    @Test
    void transientFailureIsRequeuedWithBackoffAndKeepsItsStage() {
        ResumeTask t = task(ResumeTaskStage.PROFILE, 1);
        store.recordFailure(t.getId(), StageFailure.transientFailure("LLM_UNAVAILABLE", "ollama is down"));

        assertEquals(ResumeTaskStatus.QUEUED, t.getStatus());
        assertEquals(ResumeTaskStage.PROFILE, t.getStage());
        assertTrue(t.getNextAttemptAt().isAfter(LocalDateTime.now().plusSeconds(5)), "should wait before the next try");
        assertEquals("LLM_UNAVAILABLE", t.getErrorCode());
        assertNull(t.getLockedBy());
        assertNotNull(t.getDedupeKey(), "a live task keeps its duplicate guard");
    }

    @Test
    void backoffGrowsWithEachAttempt() {
        ResumeTask first = task(ResumeTaskStage.INDEX, 1);
        ResumeTask third = task(ResumeTaskStage.INDEX, 2);
        store.recordFailure(first.getId(), StageFailure.transientFailure("X", "down"));
        store.recordFailure(third.getId(), StageFailure.transientFailure("X", "down"));
        assertTrue(third.getNextAttemptAt().isAfter(first.getNextAttemptAt().plusSeconds(5)));
    }

    @Test
    void retriesAreCappedAndTheFailureIsRecordedNotHidden() {
        ResumeTask t = task(ResumeTaskStage.SUMMARY, properties.getRetry().getMaxAttempts());
        store.recordFailure(t.getId(), StageFailure.transientFailure("LLM_UNAVAILABLE", "still down"));

        assertEquals(ResumeTaskStatus.FAILED, t.getStatus());
        assertEquals(ResumeTaskStage.SUMMARY, t.getStage(), "stays at the failed stage so a manual retry resumes there");
        assertTrue(t.getErrorMessage().contains("Gave up"));
        assertNull(t.getDedupeKey(), "a failed file must not block uploading a fixed copy");
        assertNotNull(t.getFinishedAt());
    }

    @Test
    void permanentFailureIsNotRetried() {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 1);
        store.recordFailure(t.getId(), StageFailure.permanent("ENCRYPTED_FILE", "password protected"));
        assertEquals(ResumeTaskStatus.FAILED, t.getStatus());
        assertEquals("ENCRYPTED_FILE", t.getErrorCode());
        assertNull(t.getDedupeKey());
    }

    @Test
    void needsReviewIsParkedNotFailed() {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 1);
        store.recordFailure(t.getId(), StageFailure.needsReview("SCANNED_PDF", "scan"));
        assertEquals(ResumeTaskStatus.NEEDS_REVIEW, t.getStatus());
        assertTrue(t.isNeedsReview());
    }

    // ------------------------------------------------------------ recovery

    @Test
    void tasksOfADeadWorkerAreRequeued() {
        ResumeTask t = task(ResumeTaskStage.INDEX, 1);
        t.setLockedUntil(LocalDateTime.now().minusMinutes(1));
        when(tasks.findExpiredLeases(any())).thenReturn(List.of(t));

        assertEquals(1, store.recoverExpiredLeases());
        assertEquals(ResumeTaskStatus.QUEUED, t.getStatus());
        assertEquals(ResumeTaskStage.INDEX, t.getStage(), "finished stages are not repeated");
        assertEquals("WORKER_LOST", t.getErrorCode());
        assertNull(t.getLockedBy());
    }

    @Test
    void aResumeThatKeepsKillingTheWorkerEventuallyFails() {
        ResumeTask t = task(ResumeTaskStage.PROFILE, properties.getRetry().getMaxAttempts());
        when(tasks.findExpiredLeases(any())).thenReturn(List.of(t));
        store.recoverExpiredLeases();
        assertEquals(ResumeTaskStatus.FAILED, t.getStatus());
        assertEquals("WORKER_LOST", t.getErrorCode());
    }

    @Test
    void claimReservesTasksForTheWorkerWithALease() {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 0);
        t.setStatus(ResumeTaskStatus.QUEUED);
        t.setLockedBy(null);
        t.setLockedUntil(null);
        when(tasks.lockDueTaskIds(any(), org.mockito.ArgumentMatchers.eq(3))).thenReturn(List.of(t.getId()));
        when(tasks.findAllById(List.of(t.getId()))).thenReturn(List.of(t));

        assertEquals(List.of(t.getId()), store.claim("worker-1", 3));
        assertEquals(ResumeTaskStatus.PROCESSING, t.getStatus());
        assertEquals("worker-1", t.getLockedBy());
        assertTrue(t.getLockedUntil().isAfter(LocalDateTime.now().plusMinutes(10)));
        assertNotNull(t.getStartedAt());
    }

    @Test
    void claimingNothingTouchesNothing() {
        when(tasks.lockDueTaskIds(any(), anyInt())).thenReturn(List.of());
        assertTrue(store.claim("w", 2).isEmpty());
        verify(tasks, never()).findAllById(any());
        assertTrue(store.claim("w", 0).isEmpty());
    }

    // -------------------------------------------------- candidate creation

    private void extractWith(ResumeTask t, String email, String name) {
        Map<String, Object> contact = new java.util.HashMap<>();
        contact.put("email", email);
        contact.put("name", name);
        t.setExtractJson(mapper.writeValueAsString(Map.of("text", "resume text", "contact", contact)));
    }

    private void advisoryLockAvailable() {
        when(em.createNativeQuery(anyString())).thenReturn(advisoryLock);
        when(advisoryLock.setParameter(anyString(), any())).thenReturn(advisoryLock);
        when(advisoryLock.getSingleResult()).thenReturn(null);
    }

    @Test
    void persistingTwiceCreatesOneCandidate() {
        ResumeTask t = task(ResumeTaskStage.PERSIST, 1);
        t.setCandidateId(UUID.randomUUID()); // a previous attempt committed, then the worker died
        t.setResumeId(UUID.randomUUID());

        assertEquals(TaskStore.PersistOutcome.CREATED, store.persistCandidate(t.getId()));
        assertEquals(ResumeTaskStage.INDEX, t.getStage());
        verify(candidates, never()).save(any());
        verify(resumes, never()).save(any());
    }

    @Test
    void aResumeWithoutAnEmailIsParkedBeforeTheSlowProfileStep() {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 1);
        store.saveExtract(t.getId(), Map.of("text", "resume text", "contact", new java.util.HashMap<String, Object>()));

        assertEquals(ResumeTaskStatus.NEEDS_REVIEW, t.getStatus());
        assertEquals("NO_EMAIL", t.getErrorCode());
        assertEquals(ResumeTaskStage.EXTRACT, t.getStage(), "never reaches the profile stage");
        verify(candidates, never()).save(any());
    }

    @Test
    void anApplicantWhoAlreadyAppliedIsStoppedBeforeTheSlowProfileStep() throws IOException {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 1);
        Candidate existing = Candidate.builder().id(UUID.randomUUID()).build();
        when(candidates.findByJobIdAndCandidateEmail(jobId, "jane@example.com")).thenReturn(List.of(existing));

        store.saveExtract(t.getId(), Map.of("text", "resume text", "contact", Map.of("email", "Jane@Example.com")));

        assertEquals(ResumeTaskStatus.DUPLICATE, t.getStatus());
        assertEquals(ResumeTaskStage.EXTRACT, t.getStage());
    }

    @Test
    void theProfileIsHeldOnTheTaskUntilTheCandidateExists() {
        ResumeTask t = task(ResumeTaskStage.PROFILE, 1);

        store.saveProfile(t.getId(), Map.of("profile", Map.of("name", "Jane Doe")));

        assertNotNull(t.getProfileJson());
        assertEquals(ResumeTaskStage.PERSIST, t.getStage());
        verify(aiResults, never()).save(any(), any(), any(), any());
        verify(candidates, never()).save(any());
    }

    @Test
    void aResumeWithoutAnEmailIsParkedForReview() {
        ResumeTask t = task(ResumeTaskStage.PERSIST, 1);
        extractWith(t, null, "Jane Doe");

        assertEquals(TaskStore.PersistOutcome.NEEDS_REVIEW, store.persistCandidate(t.getId()));
        assertEquals(ResumeTaskStatus.NEEDS_REVIEW, t.getStatus());
        assertEquals("NO_EMAIL", t.getErrorCode());
        verify(candidates, never()).save(any());
    }

    @Test
    void anEmailTypedInResumesAtTheProfileStepWithoutCreatingACandidate() {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 1);
        extractWith(t, null, "Jane Doe");
        t.setStatus(ResumeTaskStatus.NEEDS_REVIEW);
        t.setErrorCode("NO_EMAIL");

        assertEquals(TaskStore.EmailOutcome.QUEUED, store.supplyEmail(t.getId(), " Jane@Example.com "));

        assertEquals(ResumeTaskStatus.QUEUED, t.getStatus());
        assertEquals(ResumeTaskStage.PROFILE, t.getStage());
        assertNull(t.getErrorCode());
        assertTrue(t.getExtractJson().contains("jane@example.com"));
        verify(candidates, never()).save(any());
    }

    @Test
    void anEmailCannotBeTypedIntoAResumeThatWasNotWaitingForOne() {
        ResumeTask t = task(ResumeTaskStage.PROFILE, 1);

        assertEquals(TaskStore.EmailOutcome.NOT_APPLICABLE, store.supplyEmail(t.getId(), "jane@example.com"));
        assertEquals(ResumeTaskStatus.PROCESSING, t.getStatus());
    }

    @Test
    void theSameApplicantIsNeverCreatedTwice() throws IOException {
        ResumeTask t = task(ResumeTaskStage.PERSIST, 1);
        extractWith(t, "Jane@Example.com", "Jane Doe");
        advisoryLockAvailable();
        Candidate existing = Candidate.builder().id(UUID.randomUUID()).build();
        when(candidates.findByJobIdAndCandidateEmail(jobId, "jane@example.com")).thenReturn(List.of(existing));

        assertEquals(TaskStore.PersistOutcome.DUPLICATE, store.persistCandidate(t.getId()));
        assertEquals(ResumeTaskStatus.DUPLICATE, t.getStatus());
        assertEquals(existing.getId(), t.getCandidateId());
        assertNull(t.getDedupeKey());
        verify(candidates, never()).save(any());
        verify(fileStorage).deleteFile("resumes/x/cv.pdf");
    }

    @Test
    void anApplicantIsCreatedWithTheirEmailNormalised() {
        ResumeTask t = task(ResumeTaskStage.PERSIST, 1);
        extractWith(t, "Jane@Example.com", "Jane Doe");
        advisoryLockAvailable();
        when(candidates.findByJobIdAndCandidateEmail(any(), anyString())).thenReturn(List.of());
        Job job = new Job();
        job.setId(jobId);
        when(jobs.findById(jobId)).thenReturn(Optional.of(job));
        when(resumes.save(any())).thenAnswer(inv -> {
            Resume r = inv.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });
        when(candidates.save(any())).thenAnswer(inv -> {
            Candidate c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        assertEquals(TaskStore.PersistOutcome.CREATED, store.persistCandidate(t.getId()));

        ArgumentCaptor<Candidate> saved = ArgumentCaptor.forClass(Candidate.class);
        verify(candidates).save(saved.capture());
        assertEquals("jane@example.com", saved.getValue().getCandidateEmail());
        assertEquals("Jane Doe", saved.getValue().getCandidateName());
        ArgumentCaptor<Resume> resume = ArgumentCaptor.forClass(Resume.class);
        verify(resumes).save(resume.capture());
        assertEquals("a".repeat(64), resume.getValue().getSha256());
        assertEquals("resume text", resume.getValue().getExtractedText());
        assertNotNull(t.getCandidateId());
        assertEquals(ResumeTaskStage.INDEX, t.getStage());
    }

    // --------------------------------------------------------- manual retry

    @Test
    void retryRequeuesAtTheFailedStageAndResetsTheAttemptBudget() {
        ResumeTask t = task(ResumeTaskStage.SUMMARY, 5);
        t.setStatus(ResumeTaskStatus.FAILED);
        t.setDedupeKey(null);
        when(tasks.existsByDedupeKey(anyString())).thenReturn(false);

        assertTrue(store.retryOne(t.getId()));
        assertEquals(ResumeTaskStatus.QUEUED, t.getStatus());
        assertEquals(ResumeTaskStage.SUMMARY, t.getStage());
        assertEquals(0, t.getStageAttempts());
        assertNull(t.getErrorCode());
        assertEquals(jobId + ":" + "a".repeat(64), t.getDedupeKey());
    }

    @Test
    void onlyFailedTasksCanBeRetried() {
        ResumeTask t = task(ResumeTaskStage.DONE, 1);
        t.setStatus(ResumeTaskStatus.COMPLETED);
        assertFalse(store.retryOne(t.getId()));
        assertEquals(ResumeTaskStatus.COMPLETED, t.getStatus());
    }

    @Test
    void aFileRejectedBeforeStorageCannotBeRetried() {
        ResumeTask t = task(ResumeTaskStage.EXTRACT, 0);
        t.setStatus(ResumeTaskStatus.FAILED);
        t.setFileUrl(null);
        assertFalse(store.retryOne(t.getId()));
    }

    @Test
    void retryIsRefusedWhenTheSameFileWasUploadedAgainAndIsLive() {
        ResumeTask t = task(ResumeTaskStage.PROFILE, 5);
        t.setStatus(ResumeTaskStatus.FAILED);
        t.setDedupeKey(null);
        when(tasks.existsByDedupeKey(anyString())).thenReturn(true);
        assertFalse(store.retryOne(t.getId()));
        assertEquals(ResumeTaskStatus.FAILED, t.getStatus());
    }

    // ------------------------------------------------------------ retention

    @Test
    void uploadsThatNeverBecameCandidatesLoseTheirFileAndText() throws IOException {
        ResumeTask failed = task(ResumeTaskStage.EXTRACT, 1);
        failed.setStatus(ResumeTaskStatus.FAILED);
        failed.setExtractJson("{\"text\":\"private resume text\"}");
        when(tasks.findTop500ByStatusInAndFinishedAtBeforeAndCandidateIdIsNull(any(), any())).thenReturn(List.of(failed));
        when(tasks.findTop500ByFinishedAtBeforeAndExtractJsonIsNotNull(any())).thenReturn(List.of());

        assertEquals(1, store.purgeExpired(30, 90));

        verify(fileStorage).deleteFile("resumes/x/cv.pdf");
        assertNull(failed.getFileUrl());
        assertNull(failed.getExtractJson());
    }

    @Test
    void finishedTasksDropOnlyTheirExtractedTextCopy() throws IOException {
        ResumeTask done = task(ResumeTaskStage.DONE, 0);
        done.setStatus(ResumeTaskStatus.COMPLETED);
        done.setExtractJson("{\"text\":\"copy of resumes.extracted_text\"}");
        when(tasks.findTop500ByStatusInAndFinishedAtBeforeAndCandidateIdIsNull(any(), any())).thenReturn(List.of());
        when(tasks.findTop500ByFinishedAtBeforeAndExtractJsonIsNotNull(any())).thenReturn(List.of(done));

        assertEquals(1, store.purgeExpired(30, 90));

        assertNull(done.getExtractJson());
        assertEquals("resumes/x/cv.pdf", done.getFileUrl(), "the candidate's resume file is not the pipeline's to delete");
        verify(fileStorage, never()).deleteFile(anyString());
    }

    @Test
    void zeroDaysKeepsEverything() {
        assertEquals(0, store.purgeExpired(0, 0));
        verifyNoInteractions(fileStorage);
        verify(tasks, never()).findTop500ByStatusInAndFinishedAtBeforeAndCandidateIdIsNull(any(), any());
        verify(tasks, never()).findTop500ByFinishedAtBeforeAndExtractJsonIsNotNull(any());
    }

    // ------------------------------------------------------------ completion

    @Test
    void aCleanFinishIsCompleted() {
        ResumeTask t = task(ResumeTaskStage.DONE, 0);
        store.complete(t.getId());
        assertEquals(ResumeTaskStatus.COMPLETED, t.getStatus());
        assertNotNull(t.getFinishedAt());
        assertNull(t.getLockedBy());
    }

    @Test
    void aFlaggedResumeFinishesAsNeedsReviewNotCompleted() {
        ResumeTask t = task(ResumeTaskStage.DONE, 0);
        t.setNeedsReview(true);
        store.complete(t.getId());
        assertEquals(ResumeTaskStatus.NEEDS_REVIEW, t.getStatus());
    }
}
