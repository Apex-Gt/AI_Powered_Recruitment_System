package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CandidateRepository extends JpaRepository<Candidate, UUID> {

    List<Candidate> findByJobId(UUID jobId);

    java.util.Optional<Candidate> findByResumeId(UUID resumeId);

    List<Candidate> findByJobIdIn(java.util.Collection<UUID> jobIds);

    List<Candidate> findByJobCompanyId(UUID companyId);

    List<Candidate> findByJobIdAndJobCompanyId(UUID jobId, UUID companyId);

    List<Candidate> findByJobIdAndCandidateEmail(UUID jobId, String email);
}