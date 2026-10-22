package com.project.ai_resumerag_be.pipeline;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Polls the task table and processes due resumes with bounded concurrency. Several backend instances can run
 * this against one database: claiming uses row locks with SKIP LOCKED, so each task is taken by exactly one.
 * On shutdown it stops claiming and waits for in-flight tasks; anything unfinished keeps its stage and is
 * recovered through lease expiry after the next start.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "pipeline.worker", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ResumePipelineWorker {

    private final TaskStore store;
    private final ResumeTaskProcessor processor;
    private final PipelineProperties properties;

    private final AtomicBoolean stopping = new AtomicBoolean(false);
    private final AtomicInteger running = new AtomicInteger();
    private ExecutorService executor;
    private String workerId;

    @PostConstruct
    void start() {
        int threads = Math.max(1, properties.getWorker().getConcurrency());
        executor = Executors.newFixedThreadPool(threads, runnable -> {
            Thread t = new Thread(runnable, "resume-pipeline");
            t.setDaemon(false);
            return t;
        });
        workerId = host() + "-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("Resume pipeline worker {} started with concurrency {}", workerId, threads);
        try {
            int recovered = store.recoverExpiredLeases();
            if (recovered > 0) {
                log.warn("Recovered {} task(s) left in PROCESSING by a previous run", recovered);
            }
        } catch (RuntimeException e) {
            log.warn("Could not recover stale tasks at startup (will retry on the next poll): {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${pipeline.worker.poll-interval:2s}", initialDelayString = "${pipeline.worker.poll-interval:2s}")
    void poll() {
        if (stopping.get()) {
            return;
        }
        try {
            store.recoverExpiredLeases();
            int free = Math.max(1, properties.getWorker().getConcurrency()) - running.get();
            if (free <= 0) {
                return;
            }
            List<UUID> claimed = store.claim(workerId, free);
            for (UUID taskId : claimed) {
                running.incrementAndGet();
                executor.submit(() -> {
                    try {
                        processor.run(taskId);
                    } catch (Throwable t) { // the processor records failures itself; this is the last line of defence
                        log.error("Task {} crashed outside the processor", taskId, t);
                    } finally {
                        running.decrementAndGet();
                    }
                });
            }
        } catch (RuntimeException e) {
            // A database blip must not kill the scheduler; the next poll tries again.
            log.warn("Pipeline poll failed: {}", e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        stopping.set(true);
        if (executor == null) {
            return;
        }
        log.info("Resume pipeline worker {} stopping; waiting for {} task(s)", workerId, running.get());
        executor.shutdown();
        try {
            if (!executor.awaitTermination(properties.getWorker().getShutdownGrace().toMillis(), TimeUnit.MILLISECONDS)) {
                log.warn("{} task(s) still running at shutdown; they keep their stage and resume after lease expiry", running.get());
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            executor.shutdownNow();
        }
    }

    public int activeTasks() {
        return running.get();
    }

    private static String host() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "worker";
        }
    }
}
