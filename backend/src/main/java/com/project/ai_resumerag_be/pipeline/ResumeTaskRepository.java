package com.project.ai_resumerag_be.pipeline;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ResumeTaskRepository extends JpaRepository<ResumeTask, UUID> {

    /**
     * Locks up to {@code limit} due tasks so concurrent workers (or instances) never pick the same row.
     * Rows locked by another transaction are skipped, not waited for. Must run inside a transaction.
     */
    @Query(value = """
            SELECT id FROM resume_tasks
             WHERE status = 'QUEUED' AND next_attempt_at <= :now
             ORDER BY next_attempt_at, created_at
             LIMIT :limit
             FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<UUID> lockDueTaskIds(@Param("now") LocalDateTime now, @Param("limit") int limit);

    /** Tasks whose worker vanished (crash, kill, restart): the lease ran out while still PROCESSING. */
    @Query("select t from ResumeTask t where t.status = 'PROCESSING' and t.lockedUntil < :now")
    List<ResumeTask> findExpiredLeases(@Param("now") LocalDateTime now);

    boolean existsByDedupeKey(String dedupeKey);

    List<ResumeTask> findByJobIdAndStatusInAndCandidateIdIsNotNull(UUID jobId, Collection<ResumeTaskStatus> statuses);

    long countByJobIdAndStatusIn(UUID jobId, Collection<ResumeTaskStatus> statuses);

    Page<ResumeTask> findByBatchId(UUID batchId, Pageable pageable);

    Page<ResumeTask> findByBatchIdAndStatus(UUID batchId, ResumeTaskStatus status, Pageable pageable);

    List<ResumeTask> findByBatchId(UUID batchId);

    /** Same rows, locked, so a cancel and a worker finishing a stage cannot interleave on one task. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from ResumeTask t where t.batchId = :batchId")
    List<ResumeTask> lockByBatchId(@Param("batchId") UUID batchId);

    List<ResumeTask> findByBatchIdAndStatusIn(UUID batchId, Collection<ResumeTaskStatus> statuses);

    @Query("select t.status, count(t) from ResumeTask t where t.batchId = :batchId group by t.status")
    List<Object[]> countByStatus(@Param("batchId") UUID batchId);

    void deleteByJobId(UUID jobId);

    List<ResumeTask> findTop500ByStatusInAndFinishedAtBeforeAndCandidateIdIsNull(Collection<ResumeTaskStatus> statuses, LocalDateTime before);

    List<ResumeTask> findTop500ByFinishedAtBeforeAndExtractJsonIsNotNull(LocalDateTime before);

    /** A deleted candidate's file may be uploaded again: free its duplicate-guard key. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("update ResumeTask t set t.dedupeKey = null where t.candidateId in :candidateIds")
    void releaseDedupeKeys(@Param("candidateIds") Collection<UUID> candidateIds);
}
