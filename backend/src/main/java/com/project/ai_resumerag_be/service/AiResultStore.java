package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.dto.response.CandidateResponse;
import com.project.ai_resumerag_be.entity.AiResult;
import com.project.ai_resumerag_be.enumerators.AiResultType;
import com.project.ai_resumerag_be.repository.AiResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Persists and reads back the JSON documents the AI service pushes to the backend. */
@Service
@RequiredArgsConstructor
public class AiResultStore {

    private final AiResultRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void save(AiResultType type, UUID candidateId, UUID jobId, Map<String, Object> payload) {
        String key = refKey(type, candidateId, jobId);
        AiResult row = repository.findByRefKey(key).orElseGet(() -> AiResult.builder()
                .refKey(key)
                .type(type)
                .candidateId(candidateId)
                .jobId(jobId)
                .build());
        row.setPayload(objectMapper.writeValueAsString(payload));
        repository.save(row);
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> find(AiResultType type, UUID candidateId, UUID jobId) {
        return repository.findByRefKey(refKey(type, candidateId, jobId))
                .map(row -> (Map<String, Object>) objectMapper.readValue(row.getPayload(), Map.class));
    }

    /** Fills the AI-derived fields (match score, experience, skills) of a candidate list/detail response. */
    public void enrich(CandidateResponse response) {
        UUID candidateId = response.getId();

        if (response.getJobId() != null) {
            find(AiResultType.MATCH_SCORE, candidateId, response.getJobId())
                    .map(m -> m.get("overallScore"))
                    .filter(Number.class::isInstance)
                    .ifPresent(score -> response.setAiMatchScore(((Number) score).doubleValue()));
        }

        find(AiResultType.PROFILE, candidateId, null).ifPresent(profile -> {
            if (profile.get("total_experience_years") instanceof Number years) {
                response.setExperience((int) Math.round(years.doubleValue()));
            }
            if (profile.get("skills") instanceof List<?> skills) {
                List<String> names = new ArrayList<>();
                for (Object skill : skills) {
                    if (skill instanceof Map<?, ?> s && s.get("name") instanceof String name) {
                        names.add(name);
                    }
                }
                response.setSkills(names);
            }
        });
    }

    private static String refKey(AiResultType type, UUID candidateId, UUID jobId) {
        return type + ":" + (candidateId == null ? "-" : candidateId) + ":" + (jobId == null ? "-" : jobId);
    }
}
