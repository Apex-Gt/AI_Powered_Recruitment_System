package com.project.ai_resumerag_be.mapper;

import com.project.ai_resumerag_be.dto.request.AdminRequest;
import com.project.ai_resumerag_be.dto.request.RecruiterRequest;
import com.project.ai_resumerag_be.dto.response.UserResponse;
import com.project.ai_resumerag_be.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponse toDto(User user);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "company", ignore = true)
    @Mapping(target = "emailVerified", ignore = true)
    @Mapping(target = "phoneNumberVerified", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    User toEntity(AdminRequest adminRequest);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "company", ignore = true)
    @Mapping(target = "emailVerified", ignore = true)
    @Mapping(target = "phoneNumberVerified", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    User toEntity(RecruiterRequest recruiterRequest);
}