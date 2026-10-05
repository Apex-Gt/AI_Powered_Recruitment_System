package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CompanyRepository extends JpaRepository<Company, UUID> {

    Optional<Company> findByGstNumber(String gstNumber);

    boolean existsByGstNumber(String gstNumber);
}
