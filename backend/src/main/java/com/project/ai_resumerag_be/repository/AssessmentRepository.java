package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Assessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssessmentRepository extends JpaRepository<Assessment, UUID> {

    List<Assessment> findByCompanyIdOrderByCreatedAtDesc(UUID companyId);

    List<Assessment> findByCompanyIdAndJobIdOrderByCreatedAtDesc(UUID companyId, UUID jobId);

    Optional<Assessment> findByIdAndCompanyId(UUID id, UUID companyId);

    /** Keeps the assessments (and their results) when their job is deleted; they just stop being tied to a job. */
    @Modifying
    @Query("update Assessment a set a.job = null where a.job.id = :jobId")
    void detachJob(@Param("jobId") UUID jobId);
}
