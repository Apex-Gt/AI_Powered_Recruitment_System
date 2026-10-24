package com.project.ai_resumerag_be.pipeline;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TaskNotesTest {

    private ResumeTask task(ResumeTaskStatus status, ResumeTaskStage stage) {
        return ResumeTask.builder().status(status).stage(stage).fileUrl("resumes/cv.pdf").build();
    }

    @Test
    void aWaitingResumeSaysItIsWaitingItsTurn() {
        assertTrue(TaskNotes.of(task(ResumeTaskStatus.QUEUED, ResumeTaskStage.EXTRACT), 3).startsWith("Waiting for its turn"));
    }

    @Test
    void aPendingResumeBeingRetriedSaysWhyAndThatNoCandidateExists() {
        ResumeTask t = task(ResumeTaskStatus.QUEUED, ResumeTaskStage.PROFILE);
        t.setErrorCode("AI_SERVICE_UNAVAILABLE");
        t.setTotalAttempts(1);
        t.setStageAttempts(1);

        String note = TaskNotes.of(t, 3);

        assertTrue(note.contains("did not answer in time"), note);
        assertTrue(note.contains("attempt 2 of 3"), note);
        assertTrue(note.contains("No candidate is created"), note);
    }

    @Test
    void aFailedResumeExplainsTheCauseAndWhatToDo() {
        ResumeTask t = task(ResumeTaskStatus.FAILED, ResumeTaskStage.PROFILE);
        t.setErrorCode("PROFILE_EMPTY");
        t.setStageAttempts(3);

        String note = TaskNotes.of(t, 3);

        assertTrue(note.contains("could not find skills"), note);
        assertTrue(note.contains("tried 3 times"), note);
        assertTrue(note.contains("No candidate was created"), note);
    }

    @Test
    void aResumeWithoutAnEmailSaysNoCandidateWasCreated() {
        ResumeTask t = task(ResumeTaskStatus.NEEDS_REVIEW, ResumeTaskStage.EXTRACT);
        t.setErrorCode("NO_EMAIL");

        assertTrue(TaskNotes.of(t, 3).endsWith("No candidate was created."));
    }
}
