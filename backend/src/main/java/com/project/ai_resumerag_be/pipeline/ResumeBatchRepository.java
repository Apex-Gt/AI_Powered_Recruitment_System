package com.project.ai_resumerag_be.pipeline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ResumeBatchRepository extends JpaRepository<ResumeBatch, UUID> {

    List<ResumeBatch> findTop20ByJobIdOrderByCreatedAtDesc(UUID jobId);

    void deleteByJobId(UUID jobId);
}
