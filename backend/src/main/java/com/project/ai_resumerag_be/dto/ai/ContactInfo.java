package com.project.ai_resumerag_be.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Contact details the AI service read out of a resume. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ContactInfo {
    private String name;
    private String email;
    private String phone;
    private String location;
    /** The full profile from the same pass, forwarded to ingestion so the LLM is only asked once. */
    private java.util.Map<String, Object> profile;
}
