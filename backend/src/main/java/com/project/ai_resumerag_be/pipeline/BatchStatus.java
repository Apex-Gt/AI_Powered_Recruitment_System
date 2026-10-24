package com.project.ai_resumerag_be.pipeline;

public enum BatchStatus {
    /** Files are still being received and stored. */
    UPLOADED,
    /** Every resume is waiting for a worker. */
    QUEUED,
    PROCESSING,
    /** Every resume finished cleanly. */
    COMPLETED,
    /** Finished, but some resumes failed or need review. The rest are done and usable. */
    PARTIAL,
    /** Nothing in the batch could be processed. */
    FAILED,
    /** The recruiter cancelled the upload; unfinished resumes were stopped and what they created was removed. */
    CANCELLED
}
