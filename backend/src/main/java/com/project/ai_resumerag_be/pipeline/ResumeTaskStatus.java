package com.project.ai_resumerag_be.pipeline;

/** Lifecycle of one resume inside a batch. Terminal states: COMPLETED, FAILED, NEEDS_REVIEW, DUPLICATE, CANCELLED. */
public enum ResumeTaskStatus {
    UPLOADED,
    QUEUED,
    PROCESSING,
    COMPLETED,
    /** Retries exhausted or the file is unusable. Retryable by hand, except when the file itself is bad. */
    FAILED,
    /** Processed, but a recruiter should look (no email found, little text, scanned PDF without OCR). */
    NEEDS_REVIEW,
    /** The same file, or the same applicant, is already in this job. Nothing further happens. */
    DUPLICATE,
    /** The recruiter cancelled the upload before this resume finished. Whatever it had created was removed. */
    CANCELLED;

    public boolean isActive() {
        return this == UPLOADED || this == QUEUED || this == PROCESSING;
    }
}
