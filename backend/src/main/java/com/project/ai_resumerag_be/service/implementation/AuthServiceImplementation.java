package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.dto.request.LoginRequest;
import com.project.ai_resumerag_be.dto.request.UpdateProfileRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.LoginResponse;
import com.project.ai_resumerag_be.entity.User;
    import com.project.ai_resumerag_be.repository.UserRepository;
    import com.project.ai_resumerag_be.service.AuthService;
    import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
    import com.project.ai_resumerag_be.exception.EmailAlreadyRegisteredException;
    import com.project.ai_resumerag_be.exception.PhoneNumberAlreadyExistsException;
    import com.project.ai_resumerag_be.service.security.CustomUserDetailsService;
    import com.project.ai_resumerag_be.service.security.JwtService;
    import lombok.RequiredArgsConstructor;
    import lombok.extern.slf4j.Slf4j;
    import org.springframework.security.authentication.BadCredentialsException;
    import org.springframework.security.core.Authentication;
    import org.springframework.security.core.context.SecurityContextHolder;
    import org.springframework.security.core.userdetails.UserDetails;
    import org.springframework.security.crypto.password.PasswordEncoder;
    import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
    import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;

    @Slf4j
    @Service
    @RequiredArgsConstructor
    public class AuthServiceImplementation implements AuthService {

        private final UserRepository userRepository;
        private final PasswordEncoder bCryptPasswordEncoder;
        private final JwtService jwtService;
        private final CustomUserDetailsService customUserDetailsService;

        @Override
        public CommonResponse login(LoginRequest request) {
            User user = userRepository.findByEmail(request.getEmail()).orElse(null);

            if (user == null || !bCryptPasswordEncoder.matches(request.getPassword(), user.getPassword())) {
                log.warn("Login failed for {}", request.getEmail());
                throw new BadCredentialsException("Invalid email or password");
            }

            UserDetails userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
            String jwt = jwtService.generateJWT(userDetails);

            log.info("{} is logged in successfully", user.getUserName());

            LoginResponse loginResponse = LoginResponse.builder()
                    .accessToken(jwt)
                    .tokenType("Bearer")
                    .expiresIn(jwtService.getExpirationTime())
                    .user(LoginResponse.UserInfo.builder()
                            .id(user.getId())
                            .userName(user.getUserName())
                            .email(user.getEmail())
                            .phoneNumber(user.getPhoneNumber())
                            .emailVerified(user.getEmailVerified())
                            .phoneNumberVerified(user.getPhoneNumberVerified())
                            .role(user.getRole())
                            .companyId(user.getCompany() != null ? user.getCompany().getId() : null)
                            .companyName(user.getCompany() != null ? user.getCompany().getCompanyName() : null)
                            .active(true)
                            .createdAt(user.getCreatedAt())
                            .updatedAt(user.getUpdatedAt())
                            .build())
                    .build();

            return CommonResponse.builder()
                    .status(CommonResponseStatus.SUCCESS)
                    .data(loginResponse)
                    .code(200)
                    .message("Successfully logged in")
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        @Override
        public CommonResponse getCurrentUser() {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            
            if (authentication == null || !authentication.isAuthenticated() || 
                authentication.getPrincipal().equals("anonymousUser")) {
return CommonResponse.builder()
                    .status(CommonResponseStatus.FAILURE)
                    .code(401)
                    .message("User not authenticated")
                    .timestamp(LocalDateTime.now())
                    .build();
            }

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = userRepository.findByEmail(userDetails.getUsername()).orElse(null);

            if (user == null) {
return CommonResponse.builder()
                    .status(CommonResponseStatus.FAILURE)
                    .code(404)
                    .message("User not found")
                    .timestamp(LocalDateTime.now())
                    .build();
            }

            LoginResponse.UserInfo userInfo = LoginResponse.UserInfo.builder()
                    .id(user.getId())
                    .userName(user.getUserName())
                    .email(user.getEmail())
                    .phoneNumber(user.getPhoneNumber())
                    .emailVerified(user.getEmailVerified())
                    .phoneNumberVerified(user.getPhoneNumberVerified())
                    .role(user.getRole())
                    .companyId(user.getCompany() != null ? user.getCompany().getId() : null)
                    .companyName(user.getCompany() != null ? user.getCompany().getCompanyName() : null)
                    .active(true)
                    .createdAt(user.getCreatedAt())
                    .updatedAt(user.getUpdatedAt())
                    .build();

            return CommonResponse.builder()
                    .status(CommonResponseStatus.SUCCESS)
                    .data(userInfo)
                    .code(200)
                    .message("User fetched successfully")
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        @Override
        public void logout() {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null) {
                new SecurityContextLogoutHandler().logout(
                    null, null, authentication
                );
                SecurityContextHolder.clearContext();
            }
        }

        @Transactional
        @Override
        public CommonResponse updateCurrentUser(UpdateProfileRequest request) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            if (authentication == null || !authentication.isAuthenticated() ||
                authentication.getPrincipal().equals("anonymousUser")) {
                return CommonResponse.builder()
                        .status(CommonResponseStatus.FAILURE)
                        .code(401)
                        .message("User not authenticated")
                        .timestamp(LocalDateTime.now())
                        .build();
            }

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = userRepository.findByEmail(userDetails.getUsername()).orElse(null);

            if (user == null) {
                return CommonResponse.builder()
                        .status(CommonResponseStatus.FAILURE)
                        .code(404)
                        .message("User not found")
                        .timestamp(LocalDateTime.now())
                        .build();
            }

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

            LoginResponse.UserInfo userInfo = LoginResponse.UserInfo.builder()
                    .id(user.getId())
                    .userName(user.getUserName())
                    .email(user.getEmail())
                    .phoneNumber(user.getPhoneNumber())
                    .emailVerified(user.getEmailVerified())
                    .phoneNumberVerified(user.getPhoneNumberVerified())
                    .role(user.getRole())
                    .companyId(user.getCompany() != null ? user.getCompany().getId() : null)
                    .companyName(user.getCompany() != null ? user.getCompany().getCompanyName() : null)
                    .active(true)
                    .createdAt(user.getCreatedAt())
                    .updatedAt(user.getUpdatedAt())
                    .build();

            return CommonResponse.builder()
                    .status(CommonResponseStatus.SUCCESS)
                    .data(userInfo)
                    .code(200)
                    .message("Profile updated successfully")
                    .timestamp(LocalDateTime.now())
                    .build();
        }

    }
