package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Interview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InterviewRepository extends JpaRepository<Interview, UUID> {

    List<Interview> findByCandidateJobCompanyIdOrderByScheduledAtDesc(UUID companyId);

    Optional<Interview> findByIdAndCandidateJobCompanyId(UUID id, UUID companyId);

    void deleteByCandidateIdIn(Collection<UUID> candidateIds);
}
