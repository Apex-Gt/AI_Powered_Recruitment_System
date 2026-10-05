package com.project.ai_resumerag_be.mapper;

import com.project.ai_resumerag_be.dto.response.CompanyResponse;
import com.project.ai_resumerag_be.entity.Company;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CompanyMapper {

    CompanyResponse toCompanyResponse(Company company);
}