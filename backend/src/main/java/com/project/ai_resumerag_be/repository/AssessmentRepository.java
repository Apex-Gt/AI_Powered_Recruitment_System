package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Assessment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssessmentRepository extends JpaRepository<Assessment, UUID> {

    List<Assessment> findByCompanyIdOrderByCreatedAtDesc(UUID companyId);

    Optional<Assessment> findByIdAndCompanyId(UUID id, UUID companyId);
}
