package com.project.ai_resumerag_be.repository;

import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByPhoneNumber(String phoneNumber);

    List<User> findByCompanyAndRole(Company company, Role role);

    Optional<User> findByIdAndCompany(UUID id, Company company);

    Optional<Company> findByPhoneNumber(String phoneNumber);
}
