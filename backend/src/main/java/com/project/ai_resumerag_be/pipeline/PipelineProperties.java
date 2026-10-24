package com.project.ai_resumerag_be.pipeline;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;

import java.time.Duration;
import java.util.Set;

/** Everything tunable about the resume pipeline, all overridable by environment variables (PIPELINE_...). */
@Component
@ConfigurationProperties(prefix = "pipeline")
@Getter
@Setter
public class PipelineProperties {

    private Upload upload = new Upload();
    private Worker worker = new Worker();
    private Retry retry = new Retry();
    private Ai ai = new Ai();
    private Retention retention = new Retention();

    /** Bumped whenever scoring or prompts change, so cached results are recomputed. Part of the cache key. */
    private String analysisVersion = "2.1";

    /** Model tag used for the summary cache key. Informational: the AI service decides the model it really runs. */
    private String modelTag = "qwen3:4b";

    @Getter
    @Setter
    public static class Upload {
        private int maxFiles = 500;
        private DataSize maxFileSize = DataSize.ofMegabytes(10);
        private DataSize maxBatchSize = DataSize.ofMegabytes(600);
        private Set<String> allowedExtensions = Set.of("pdf", "docx", "txt");
    }

    @Getter
    @Setter
    public static class Worker {
        private boolean enabled = true;
        /** Resumes processed at once. Each can hold a local-LLM call, so keep this low and benchmark before raising it. */
        private int concurrency = 2;
        private Duration pollInterval = Duration.ofSeconds(2);
        /** How long a claimed task is reserved. Renewed before every stage; expiry means the worker died. */
        private Duration lease = Duration.ofMinutes(15);
        private Duration shutdownGrace = Duration.ofSeconds(60);
    }

    @Getter
    @Setter
    public static class Retry {
        /** Attempts per stage for transient failures (Ollama or Qdrant down, timeouts). */
        /** 3 attempts, 10 s then 20 s apart: a resume that cannot be read shows why within a few minutes instead of idling. */
        private int maxAttempts = 3;
        private Duration baseDelay = Duration.ofSeconds(10);
        private Duration maxDelay = Duration.ofMinutes(1);
    }

    /** How long resume data is kept for uploads that did NOT become a candidate. Candidates follow their own lifecycle. */
    @Getter
    @Setter
    public static class Retention {
        private boolean enabled = true;
        /** Failed, needs-review and duplicate uploads: the stored file and extracted text are deleted after this many days. 0 keeps them. */
        private int unusableDays = 30;
        /** Finished tasks: the extracted-text copy is dropped after this many days (the candidate's own resume record is untouched). 0 keeps it. */
        private int extractedTextDays = 90;
        private String cron = "0 30 3 * * *";
    }

    @Getter
    @Setter
    public static class Ai {
        /** Sent as X-API-Key to the AI service's pipeline endpoints (its PIPELINE_API_KEY). Empty sends nothing. */
        private String apiKey = "";
        private Duration extractTimeout = Duration.ofSeconds(60);
        private Duration profileTimeout = Duration.ofMinutes(3);
        private Duration indexTimeout = Duration.ofMinutes(5);
        private Duration scoreTimeout = Duration.ofSeconds(90);
        private Duration summaryTimeout = Duration.ofMinutes(3);
    }
}
