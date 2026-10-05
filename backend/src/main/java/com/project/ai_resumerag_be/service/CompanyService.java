package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.request.CompanyRequest;
import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.entity.Company;

import java.util.UUID;

public interface CompanyService {
    CommonResponse registerCompanyAndCreateAdmin(CompanyRequest companyRequest);
    CommonResponse getCompanyForAdmin();
    CommonResponse getCompanyById(UUID companyId);
    CommonResponse updateCompanyForAdmin(CompanyRequest request);
}
