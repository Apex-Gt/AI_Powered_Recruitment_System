package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.AssessmentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssessmentAttemptRepository extends JpaRepository<AssessmentAttempt, UUID> {

    Optional<AssessmentAttempt> findByTokenHash(String tokenHash);

    List<AssessmentAttempt> findByAssessmentCompanyIdOrderByCreatedAtDesc(UUID companyId);

    Optional<AssessmentAttempt> findByIdAndAssessmentCompanyId(UUID id, UUID companyId);

    boolean existsByAssessmentId(UUID assessmentId);

    void deleteByAssessmentId(UUID assessmentId);

    void deleteByCandidateIdIn(Collection<UUID> candidateIds);
}
