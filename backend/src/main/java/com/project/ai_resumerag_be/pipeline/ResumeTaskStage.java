package com.project.ai_resumerag_be.pipeline;

/**
 * Pipeline stages in execution order. The task remembers the next stage to run, so a retry or a restart
 * resumes where it stopped instead of repeating finished (and expensive) work.
 */
public enum ResumeTaskStage {
    /** Read the file, take deterministic contact fields. No LLM. */
    EXTRACT,
    /** Create the Resume and Candidate rows. */
    PERSIST,
    /** Local-LLM structured profile (skills, employment history, education). */
    PROFILE,
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
