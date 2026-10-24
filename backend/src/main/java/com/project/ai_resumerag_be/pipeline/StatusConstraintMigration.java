package com.project.ai_resumerag_be.pipeline;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Hibernate's {@code ddl-auto=update} never widens the CHECK constraint it once generated for an enum column, so
 * databases created before {@code CANCELLED} existed would reject it. Dropping the stale constraints is idempotent
 * and harmless: the value is still constrained by the enum mapping, and new databases get the full constraint.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class StatusConstraintMigration {

    private final JdbcTemplate jdbc;

    @PostConstruct
    void dropStaleStatusChecks() {
        for (String statement : new String[] {
                "ALTER TABLE IF EXISTS resume_tasks DROP CONSTRAINT IF EXISTS resume_tasks_status_check",
                "ALTER TABLE IF EXISTS resume_batches DROP CONSTRAINT IF EXISTS resume_batches_status_check"}) {
            try {
                jdbc.execute(statement);
            } catch (RuntimeException e) {
                log.warn("Could not relax status constraint ({}): {}", statement, e.getMessage());
            }
        }
    }
}
