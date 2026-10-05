package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.request.AdminRequest;
import com.project.ai_resumerag_be.dto.request.CompanyRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.CompanyRegistrationResponse;
import com.project.ai_resumerag_be.dto.response.CompanyResponse;
import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
import com.project.ai_resumerag_be.exception.ConflictException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.mapper.CompanyMapper;
import com.project.ai_resumerag_be.repository.CompanyRepository;
import com.project.ai_resumerag_be.repository.UserRepository;
import com.project.ai_resumerag_be.service.CompanyService;
import com.project.ai_resumerag_be.service.UserService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CompanyServiceImplementation implements CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final CompanyMapper companyMapper;

    @Transactional
    @Override
    public CommonResponse registerCompanyAndCreateAdmin(CompanyRequest companyRequest) {

        if (companyRepository.existsByGstNumber(companyRequest.getGstNumber())) {
            throw new ConflictException("Company with this GST number already exists");
        }

        Company company = Company.builder()
                .companyName(companyRequest.getCompanyName())
                .country(companyRequest.getCountry())
                .state(companyRequest.getState())
                .city(companyRequest.getCity())
                .gstNumber(companyRequest.getGstNumber())
                .companyVerified(false)
                .active(true)
                .build();

        company = companyRepository.save(company);

        AdminRequest adminRequest = AdminRequest.builder()
                .email(companyRequest.getAdminEmail())
                .userName(companyRequest.getAdminUserName())
                .password(companyRequest.getPassword())
                .phoneNumber(companyRequest.getAdminPhoneNumber())
                .company(company)
                .build();

        userService.createAdminUser(adminRequest, company);

        User adminUser = userRepository.findByEmail(companyRequest.getAdminEmail()).orElseThrow();

        CompanyRegistrationResponse response = CompanyRegistrationResponse.builder()
                .company(CompanyRegistrationResponse.CompanyInfo.builder()
                        .id(company.getId())
                        .companyName(company.getCompanyName())
                        .country(company.getCountry())
                        .state(company.getState())
                        .city(company.getCity())
                        .gstNumber(company.getGstNumber())
                        .companyVerified(company.getCompanyVerified())
                        .active(company.getActive())
                        .createdAt(company.getCreatedAt())
                        .updatedAt(company.getUpdatedAt())
                        .build())
                .admin(CompanyRegistrationResponse.AdminInfo.builder()
                        .id(adminUser.getId())
                        .userName(adminUser.getUserName())
                        .email(adminUser.getEmail())
                        .phoneNumber(adminUser.getPhoneNumber())
                        .emailVerified(adminUser.getEmailVerified())
                        .phoneNumberVerified(adminUser.getPhoneNumberVerified())
                        .role(adminUser.getRole())
                        .createdAt(adminUser.getCreatedAt())
                        .updatedAt(adminUser.getUpdatedAt())
                        .build())
                .build();

        return CommonResponse.builder()
                .data(response)
                .code(201)
                .message("Company and admin registered successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getCompanyForAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = customUserDetails.getUser();

        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("User is not associated with a company");
        }

        CompanyResponse companyResponse = companyMapper.toCompanyResponse(user.getCompany());

        return CommonResponse.builder()
                .code(200)
                .data(companyResponse)
                .message("Company details retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getCompanyById(UUID companyId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = customUserDetails.getUser();

        if (user.getCompany() == null || !user.getCompany().getId().equals(companyId)) {
            throw new ResourceNotFoundException("Company not found or access denied");
        }

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        CompanyResponse companyResponse = companyMapper.toCompanyResponse(company);

        return CommonResponse.builder()
                .code(200)
                .data(companyResponse)
                .message("Company details retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse updateCompanyForAdmin(CompanyRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = customUserDetails.getUser();

        if (user.getCompany() == null) {
            throw new ResourceNotFoundException("User is not associated with a company");
        }

        Company company = companyRepository.findById(user.getCompany().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        // Update only allowed fields
        if (request.getCompanyName() != null) {
            company.setCompanyName(request.getCompanyName());
        }
        if (request.getCountry() != null) {
            company.setCountry(request.getCountry());
        }
        if (request.getState() != null) {
            company.setState(request.getState());
        }
        if (request.getCity() != null) {
            company.setCity(request.getCity());
        }
        if (request.getIndustry() != null) {
            company.setIndustry(request.getIndustry());
        }
        // Cannot change: companyVerified, active, gstNumber, companyId

        company = companyRepository.save(company);

        CompanyResponse companyResponse = companyMapper.toCompanyResponse(company);

        return CommonResponse.builder()
                .code(200)
                .data(companyResponse)
                .message("Company updated successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
