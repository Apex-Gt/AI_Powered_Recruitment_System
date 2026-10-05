package com.project.ai_resumerag_be.controller;

import com.project.ai_resumerag_be.dto.request.CompanyRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.service.CompanyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/company")
public class CompanyController {

    private final CompanyService companyService;

    @PostMapping("/register")
    public ResponseEntity<CommonResponse> registerCompany(@RequestBody CompanyRequest companyRequest) {
        CommonResponse response = companyService.registerCompanyAndCreateAdmin(companyRequest);

        return ResponseEntity.status(response.getCode()).body(response);
    }
}
