package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.CandidateNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CandidateNoteRepository extends JpaRepository<CandidateNote, UUID> {

    List<CandidateNote> findByCandidateIdOrderByCreatedAtDesc(UUID candidateId);

    void deleteByCandidateIdIn(Collection<UUID> candidateIds);
}
