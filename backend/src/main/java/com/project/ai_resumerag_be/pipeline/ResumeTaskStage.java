package com.project.ai_resumerag_be.pipeline;

/**
 * Pipeline stages in execution order. The task remembers the next stage to run, so a retry or a restart
 * resumes where it stopped instead of repeating finished (and expensive) work.
 */
public enum ResumeTaskStage {
    /** Read the file, take deterministic contact fields. No LLM. */
    EXTRACT,
    /** LLM structured profile (skills, employment history, education). Kept on the task, not yet on a candidate. */
    PROFILE,
    /** Create the Resume and Candidate rows and attach the profile. Only reached once the profile succeeded. */
    PERSIST,
    /** Chunk, embed and upsert into the vector store. */
    INDEX,
    /** Explainable deterministic match score. */
    SCORE,
    /** Grounded recruiter summary (local LLM). */
    SUMMARY,
    DONE;

    public ResumeTaskStage next() {
        return values()[Math.min(ordinal() + 1, values().length - 1)];
    }
}
