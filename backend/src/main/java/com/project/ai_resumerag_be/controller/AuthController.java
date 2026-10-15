package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.dto.response.LoginResponse;
import com.project.ai_resumerag_be.dto.request.LoginRequest;
import com.project.ai_resumerag_be.dto.request.UpdateProfileRequest;
import com.project.ai_resumerag_be.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // Set app.cookie.secure=true behind HTTPS in production
    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @PostMapping("/login")
    public ResponseEntity<CommonResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        CommonResponse commonResponse = authService.login(request);

        LoginResponse loginResponse = (LoginResponse) commonResponse.getData();
        String jwt = loginResponse.getAccessToken();

        // HttpOnly JWT cookie; Max-Age matches the JWT lifetime (jwt.expiration, 24h)
        response.addHeader(HttpHeaders.SET_COOKIE, buildJwtCookie(jwt, loginResponse.getExpiresIn()).toString());

        return ResponseEntity.status(commonResponse.getCode()).body(commonResponse);
    }

    private ResponseCookie buildJwtCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from("jwt", value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/api") // Match Spring Boot context-path
                .maxAge(maxAgeSeconds)
                .build();
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
        response.addHeader(HttpHeaders.SET_COOKIE, buildJwtCookie("", 0).toString());

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
