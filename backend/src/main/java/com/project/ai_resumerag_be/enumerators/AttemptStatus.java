package com.project.ai_resumerag_be.enumerators;

public enum AttemptStatus {
    /** Link sent, candidate has not opened the assessment yet. */
    ASSIGNED,
    IN_PROGRESS,
    /** Submitted, some answers still need manual review. */
    SUBMITTED,
    /** Every answer has a score. */
    GRADED,
    EXPIRED
}
