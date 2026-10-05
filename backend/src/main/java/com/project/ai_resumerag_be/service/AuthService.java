package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.request.LoginRequest;
import com.project.ai_resumerag_be.dto.request.UpdateProfileRequest;
import com.project.ai_resumerag_be.entity.User;

public interface AuthService {
    CommonResponse login(LoginRequest request);
    CommonResponse getCurrentUser();
    void logout();
    CommonResponse updateCurrentUser(UpdateProfileRequest request);
}
