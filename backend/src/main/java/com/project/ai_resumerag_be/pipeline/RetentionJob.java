package com.project.ai_resumerag_be.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily clean-up of resume data that is past its configured retention (see pipeline.retention.*). */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "pipeline.retention", name = "enabled", havingValue = "true", matchIfMissing = true)
public class RetentionJob {

    private final TaskStore store;
    private final PipelineProperties properties;

    @Scheduled(cron = "${pipeline.retention.cron:0 30 3 * * *}")
    public void run() {
        PipelineProperties.Retention retention = properties.getRetention();
        try {
            int changed = store.purgeExpired(retention.getUnusableDays(), retention.getExtractedTextDays());
            if (changed > 0) {
                log.info("Retention: cleared stored data of {} resume task(s)", changed);
            }
        } catch (RuntimeException e) {
            log.warn("Retention run failed, will try again tomorrow: {}", e.getMessage());
        }
    }
}
