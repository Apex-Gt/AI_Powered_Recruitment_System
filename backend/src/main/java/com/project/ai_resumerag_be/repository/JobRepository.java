package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JobRepository extends JpaRepository<Job, UUID> {

    List<Job> findByCreatedBy(User user);

    List<Job> findByCompany(Company company);

    Optional<Job> findByIdAndCompany(UUID id, Company company);

    Optional<Job> findByIdAndCreatedBy(UUID id, User user);
}