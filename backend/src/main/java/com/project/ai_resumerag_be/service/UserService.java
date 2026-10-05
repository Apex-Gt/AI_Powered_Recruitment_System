package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.request.AdminRequest;
import com.project.ai_resumerag_be.dto.request.RecruiterRequest;
import com.project.ai_resumerag_be.dto.request.UpdateProfileRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.UserResponse;
import com.project.ai_resumerag_be.entity.Company;

import java.util.List;
import java.util.UUID;

public interface UserService {
    CommonResponse createRecruiterUser(RecruiterRequest recruiterRequest);

    void createAdminUser(AdminRequest adminRequest, Company company);

    CommonResponse getRecruitersForAdmin();
    CommonResponse getRecruiterByIdForAdmin(UUID recruiterId);
    CommonResponse getCurrentUser();
    CommonResponse updateRecruiterForAdmin(UUID recruiterId, RecruiterRequest request);
    CommonResponse updateCurrentUser(UpdateProfileRequest request);
    CommonResponse deleteRecruiterForAdmin(UUID recruiterId);
}
