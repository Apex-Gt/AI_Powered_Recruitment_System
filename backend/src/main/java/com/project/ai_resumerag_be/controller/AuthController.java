package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.LoginResponse;
import com.project.ai_resumerag_be.dto.request.LoginRequest;
import com.project.ai_resumerag_be.dto.request.UpdateProfileRequest;
import com.project.ai_resumerag_be.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<CommonResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        CommonResponse commonResponse = authService.login(request);

        LoginResponse loginResponse = (LoginResponse) commonResponse.getData();
        String jwt = loginResponse.getAccessToken();

        Cookie cookie = new Cookie("jwt", jwt);

        cookie.setHttpOnly(true);
        cookie.setSecure(false); // true in prod for https
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60); // 1hr

        response.addCookie(cookie);

        return ResponseEntity.status(commonResponse.getCode()).body(commonResponse);
    }

    @GetMapping("/me")
    public ResponseEntity<CommonResponse> getCurrentUser() {
        CommonResponse response = authService.getCurrentUser();
        return ResponseEntity.status(response.getCode()).body(response);
    }

@PostMapping("/logout")
    public ResponseEntity<CommonResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout();

        // Clear the JWT cookie
        Cookie cookie = new Cookie("jwt", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok(CommonResponse.builder()
                .status(com.project.ai_resumerag_be.enumerators.CommonResponseStatus.SUCCESS)
                .code(200)
                .message("Logged out successfully")
                .timestamp(java.time.LocalDateTime.now())
                .build());
    }

    @PutMapping("/me")
    public ResponseEntity<CommonResponse> updateCurrentUser(@Valid @RequestBody UpdateProfileRequest request) {
        CommonResponse response = authService.updateCurrentUser(request);
        return ResponseEntity.status(response.getCode()).body(response);
    }
}
