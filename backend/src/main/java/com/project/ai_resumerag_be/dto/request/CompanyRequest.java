package com.project.ai_resumerag_be.dto.request;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class CompanyRequest {
    private String companyName;

    private String country;

    private String state;

    private String city;

    private String industry;

    private String gstNumber;

    private String logo;

    private String adminUserName;
    private String adminPhoneNumber;
    private String adminEmail;
    private String password;
}
