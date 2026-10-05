package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.request.AdminRequest;
import com.project.ai_resumerag_be.dto.request.RecruiterRequest;
import com.project.ai_resumerag_be.dto.request.UpdateProfileRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.UserResponse;
import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
import com.project.ai_resumerag_be.enumerators.Role;
import com.project.ai_resumerag_be.exception.EmailAlreadyRegisteredException;
import com.project.ai_resumerag_be.exception.PhoneNumberAlreadyExistsException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.mapper.UserMapper;
import com.project.ai_resumerag_be.repository.CompanyRepository;
import com.project.ai_resumerag_be.repository.UserRepository;
import com.project.ai_resumerag_be.service.EmailService;
import com.project.ai_resumerag_be.service.UserService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserServiceImplementation implements UserService {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Transactional
    @Override
    public CommonResponse  createRecruiterUser(RecruiterRequest recruiterRequest) {

        log.info("Signup request received for {}", recruiterRequest.getEmail());

        if(userRepository.existsByEmail(recruiterRequest.getEmail())){
            log.warn("Signup failed. Email already registered: {}", recruiterRequest.getEmail());
            throw new EmailAlreadyRegisteredException("Email already exists");
        }
        if(userRepository.existsByPhoneNumber(recruiterRequest.getPhoneNumber())){
            log.warn("Signup failed. Phone number already registered: {}", recruiterRequest.getPhoneNumber());
            throw new PhoneNumberAlreadyExistsException("Phone number already exists");
        }

        // gets company id from the authenticated user (security context)
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        CustomUserDetails userDetails =
                (CustomUserDetails) authentication.getPrincipal();

        UUID companyId =
                userDetails.getUser().getCompany().getId();

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        log.debug("Creating a user {}", recruiterRequest.getEmail());
        User user = userMapper.toEntity(recruiterRequest);

        user.setPassword(passwordEncoder.encode(recruiterRequest.getPassword()));
        user.setRole(Role.RECRUITER);
        user.setCompany(company);
        user.setEmailVerified(false);
        user.setPhoneNumberVerified(false);

        user  = userRepository.save(user);
        log.info("{} is signed up successfully", user.getUserName());

        String loginUrl = frontendUrl + "/login";
        emailService.sendRecruiterCredentials(user.getEmail(), user.getUserName(), recruiterRequest.getPassword(), loginUrl, company.getCompanyName());

        return CommonResponse.builder()
                .data(userMapper.toDto(user))
                .code(201)
                .message("Recruiter created successfully")
                .timestamp(LocalDateTime.now())
                .status(CommonResponseStatus.SUCCESS)
                .build();
    }

    @Transactional
    @Override
    public void createAdminUser(AdminRequest adminRequest, Company company) {

        if(userRepository.existsByEmail(adminRequest.getEmail())){
            log.warn("Signup failed. Email already registered: {}", adminRequest.getEmail());
            throw new EmailAlreadyRegisteredException("Email already exists");
        }
        if(userRepository.existsByPhoneNumber(adminRequest.getPhoneNumber())){
            log.warn("Signup failed. Phone number already registered: {}", adminRequest.getPhoneNumber());
            throw new PhoneNumberAlreadyExistsException("Phone number already exists");
        }

        User user = userMapper.toEntity(adminRequest);

        user.setPassword(passwordEncoder.encode(adminRequest.getPassword()));
        user.setRole(Role.ADMIN);
        user.setCompany(company);
        user.setEmailVerified(false);
        user.setPhoneNumberVerified(false);

        user = userRepository.save(user);

        userMapper.toDto(user);
    }

    @Override
    public CommonResponse getRecruitersForAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User admin = customUserDetails.getUser();

        if (admin.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (admin.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        List<User> recruiters = userRepository.findByCompanyAndRole(admin.getCompany(), Role.RECRUITER);

        List<UserResponse> recruiterResponses = recruiters.stream()
                .map(userMapper::toDto)
                .collect(Collectors.toList());

        return CommonResponse.builder()
                .code(200)
                .data(recruiterResponses)
                .message("Recruiters retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getRecruiterByIdForAdmin(UUID recruiterId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User admin = customUserDetails.getUser();

        if (admin.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (admin.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        User recruiter = userRepository.findByIdAndCompany(recruiterId, admin.getCompany())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter not found"));

        if (recruiter.getRole() != Role.RECRUITER) {
            throw new ResourceNotFoundException("User is not a recruiter");
        }

        return CommonResponse.builder()
                .code(200)
                .data(userMapper.toDto(recruiter))
                .message("Recruiter retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public CommonResponse getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = customUserDetails.getUser();

        return CommonResponse.builder()
                .code(200)
                .data(userMapper.toDto(user))
                .message("User retrieved successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse updateRecruiterForAdmin(UUID recruiterId, RecruiterRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User admin = customUserDetails.getUser();

        if (admin.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (admin.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        User recruiter = userRepository.findByIdAndCompany(recruiterId, admin.getCompany())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter not found"));

        if (recruiter.getRole() != Role.RECRUITER) {
            throw new ResourceNotFoundException("User is not a recruiter");
        }

        // Update allowed fields only
        if (request.getUserName() != null) {
            recruiter.setUserName(request.getUserName());
        }
        if (request.getEmail() != null) {
            if (userRepository.existsByEmail(request.getEmail()) && 
                !userRepository.findByEmail(request.getEmail()).get().getId().equals(recruiterId)) {
                throw new EmailAlreadyRegisteredException("Email already exists");
            }
            recruiter.setEmail(request.getEmail());
        }
        if (request.getPhoneNumber() != null) {
            if (userRepository.existsByPhoneNumber(request.getPhoneNumber()) && 
                !userRepository.findByPhoneNumber(request.getPhoneNumber()).get().getId().equals(recruiterId)) {
                throw new PhoneNumberAlreadyExistsException("Phone number already exists");
            }
            recruiter.setPhoneNumber(request.getPhoneNumber());
        }
        // Cannot change: role, companyId, password (separate endpoint), emailVerified, phoneNumberVerified

        recruiter = userRepository.save(recruiter);

        return CommonResponse.builder()
                .code(200)
                .data(userMapper.toDto(recruiter))
                .message("Recruiter updated successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse updateCurrentUser(UpdateProfileRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = customUserDetails.getUser();

        // Update allowed fields only
        if (request.getUserName() != null) {
            user.setUserName(request.getUserName());
        }
        if (request.getEmail() != null) {
            if (userRepository.existsByEmail(request.getEmail()) && 
                !userRepository.findByEmail(request.getEmail()).get().getId().equals(user.getId())) {
                throw new EmailAlreadyRegisteredException("Email already exists");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getPhoneNumber() != null) {
            if (userRepository.existsByPhoneNumber(request.getPhoneNumber()) && 
                !userRepository.findByPhoneNumber(request.getPhoneNumber()).get().getId().equals(user.getId())) {
                throw new PhoneNumberAlreadyExistsException("Phone number already exists");
            }
            user.setPhoneNumber(request.getPhoneNumber());
        }
        // Cannot change: role, companyId, password (separate endpoint), emailVerified, phoneNumberVerified

        user = userRepository.save(user);

        return CommonResponse.builder()
                .code(200)
                .data(userMapper.toDto(user))
                .message("Profile updated successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Transactional
    @Override
    public CommonResponse deleteRecruiterForAdmin(UUID recruiterId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails customUserDetails = (CustomUserDetails) authentication.getPrincipal();
        User admin = customUserDetails.getUser();

        if (admin.getRole() != Role.ADMIN) {
            throw new ResourceNotFoundException("Only admins can access this resource");
        }

        if (admin.getCompany() == null) {
            throw new ResourceNotFoundException("Admin is not associated with a company");
        }

        User recruiter = userRepository.findByIdAndCompany(recruiterId, admin.getCompany())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter not found"));

        if (recruiter.getRole() != Role.RECRUITER) {
            throw new ResourceNotFoundException("User is not a recruiter");
        }

        // Prevent deleting self
        if (recruiter.getId().equals(admin.getId())) {
            throw new ResourceNotFoundException("Cannot delete your own account");
        }

        userRepository.delete(recruiter);

        return CommonResponse.builder()
                .code(200)
                .message("Recruiter deleted successfully")
                .status(CommonResponseStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
