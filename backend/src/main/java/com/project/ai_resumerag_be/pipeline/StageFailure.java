package com.project.ai_resumerag_be.pipeline;

/** A pipeline stage did not succeed. The kind decides what the queue does next. */
public class StageFailure extends RuntimeException {

    public enum Kind {
        /** A dependency is down or slow: back off and try again. */
        TRANSIENT,
        /** The document or request is bad: retrying cannot help, so fail it without retrying. */
        PERMANENT,
        /** Nothing is wrong with the system, but a person should look at this resume. */
        NEEDS_REVIEW
    }

    private final Kind kind;
    private final String code;

    public StageFailure(Kind kind, String code, String message) {
        super(message);
        this.kind = kind;
        this.code = code;
    }

    public StageFailure(Kind kind, String code, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.code = code;
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }

    public static StageFailure transientFailure(String code, String message) {
        return new StageFailure(Kind.TRANSIENT, code, message);
    }

    public static StageFailure permanent(String code, String message) {
        return new StageFailure(Kind.PERMANENT, code, message);
    }

    public static StageFailure needsReview(String code, String message) {
        return new StageFailure(Kind.NEEDS_REVIEW, code, message);
    }
}
