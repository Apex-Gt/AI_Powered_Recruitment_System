package com.project.ai_resumerag_be.pipeline;

import java.util.UUID;

/** Thrown to a worker whose task was cancelled (or otherwise taken away) while it was running; the worker just stops. */
public class TaskNoLongerRunning extends RuntimeException {

    public TaskNoLongerRunning(UUID taskId) {
        super("Task " + taskId + " is no longer running");
    }
}
