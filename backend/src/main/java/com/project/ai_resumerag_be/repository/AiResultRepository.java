package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.AiResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiResultRepository extends JpaRepository<AiResult, UUID> {

    Optional<AiResult> findByRefKey(String refKey);

    void deleteByCandidateIdIn(Collection<UUID> candidateIds);

    java.util.List<AiResult> findByTypeAndJobIdIn(com.project.ai_resumerag_be.enums.AiResultType type, Collection<UUID> jobIds);

    void deleteByJobId(UUID jobId);
}
