package com.project.ai_resumerag_be.pipeline;

import java.util.Map;

/**
 * Plain-language explanation shown beside a resume: what is happening to it right now, or why it stopped and what
 * the recruiter can do. Written for someone who has never heard of a pipeline, a model or a queue.
 */
final class TaskNotes {

    private TaskNotes() {
    }

    /** Why a step went wrong, in a sentence that fits after "because". */
    private static final Map<String, String> CAUSE = Map.ofEntries(
            Map.entry("ENCRYPTED_FILE", "The PDF is password protected. Upload an unlocked copy."),
            Map.entry("CORRUPT_FILE", "The file is damaged and cannot be opened."),
            Map.entry("UNSUPPORTED_TYPE", "Only PDF, DOCX and TXT resumes are supported."),
            Map.entry("INVALID_CONTENT", "The file content does not match its extension."),
            Map.entry("EMPTY_FILE", "The file is empty."),
            Map.entry("FILE_TOO_LARGE", "The file is too large (limit 10 MB)."),
            Map.entry("NO_EMAIL", "No email address was found in the resume, so a candidate cannot be created yet. Type the email in below, or upload a copy that includes one."),
            Map.entry("PROFILE_MISSING", "The extracted details were not saved yet."),
            Map.entry("SCANNED_PDF", "This looks like a scanned image with no readable text. Upload a text-based copy."),
            Map.entry("DUPLICATE_FILE", "This exact file is already in this job."),
            Map.entry("DUPLICATE_APPLICANT", "This person has already applied for this job."),
            Map.entry("PROFILE_EMPTY", "The AI could not find skills or experience in this resume. Check that the file reads normally, then try again."),
            Map.entry("LLM_UNAVAILABLE", "The AI model is not responding."),
            Map.entry("AI_SERVICE_UNAVAILABLE", "The AI service did not answer in time."),
            Map.entry("AI_SERVICE_ERROR", "The AI service reported a problem."),
            Map.entry("AI_SERVICE_AUTH", "The AI service refused the connection (its access key does not match)."),
            Map.entry("DEPENDENCY_TIMEOUT", "The AI model took too long to answer."),
            Map.entry("VECTOR_STORE_UNAVAILABLE", "The search index is not responding."),
            Map.entry("EMBEDDING_UNAVAILABLE", "The embedding model is not responding."),
            Map.entry("WORKER_LOST", "The program reading this resume stopped unexpectedly."),
            Map.entry("UPLOAD_ERROR", "The file could not be read from the upload."),
            Map.entry("INTERNAL_ERROR", "Something unexpected went wrong."));

    private static String stageText(ResumeTaskStage stage) {
        return switch (stage) {
            case EXTRACT -> "Reading the text and contact details from the file.";
            case PROFILE -> "The AI is reading the resume and picking out skills, experience and education. This is the slowest step.";
            case PERSIST -> "Saving the candidate.";
            case INDEX -> "Getting the resume ready to be ranked.";
            case SCORE -> "Scoring the resume against the job.";
            case SUMMARY -> "Writing a short summary for the recruiter.";
            case DONE -> "Finishing up.";
        };
    }

    static String of(ResumeTask t, int maxAttempts) {
        String cause = t.getErrorCode() == null ? null : CAUSE.get(t.getErrorCode());
        switch (t.getStatus()) {
            case UPLOADED, QUEUED -> {
                if (t.getErrorCode() != null && t.getTotalAttempts() > 0) {
                    int next = Math.min(maxAttempts, t.getStageAttempts() + 1);
                    String reason = cause != null ? cause : (t.getErrorMessage() != null ? t.getErrorMessage() : "Something went wrong.");
                    return "Still pending. " + reason + " Trying again (attempt " + next + " of "
                            + maxAttempts + "). No candidate is created until this works.";
                }
                return "Waiting for its turn. Resumes are read a few at a time.";
            }
            case PROCESSING -> {
                String text = stageText(t.getStage());
                return t.getStageAttempts() > 1 ? text + " Second try: the first one did not work out." : text;
            }
            case FAILED -> {
                String why = cause != null ? cause : (t.getErrorMessage() != null ? t.getErrorMessage() : "Something went wrong.");
                String tail = t.getFileUrl() != null
                        ? " It was tried " + Math.max(1, t.getStageAttempts()) + (t.getStageAttempts() == 1 ? " time" : " times")
                                + " and stopped. No candidate was created. Use Retry once the cause is fixed."
                        : " No candidate was created.";
                return why + tail;
            }
            case NEEDS_REVIEW -> {
                String why = cause != null ? cause : (t.getErrorMessage() != null ? t.getErrorMessage() : "A recruiter should look at this one.");
                return t.getCandidateId() == null ? why + " No candidate was created." : why;
            }
            case DUPLICATE -> {
                return cause != null ? cause : "This resume is already in the job.";
            }
            case COMPLETED -> {
                return t.getRankRunAt() != null ? "Ranked: scored against the job and a short explanation written." : null;
            }
            case CANCELLED -> {
                return "The upload was cancelled before this resume finished.";
            }
            default -> {
                return null;
            }
        }
    }
}
