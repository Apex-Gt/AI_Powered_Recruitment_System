package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.JobSkill;
import com.project.ai_resumerag_be.service.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmbeddingServiceImplementation implements EmbeddingService {

    private final EmbeddingModel embeddingModel;

    @Override
    public float[] generateJobEmbedding(Job job) {

        String jobText = buildJobText(job);

        return embeddingModel.embed(jobText);
    }

    private String buildJobText(Job job) {

        String skills = job.getSkills() == null
                ? ""
                : job.getSkills()
                .stream()
                .map(js -> js.getSkill() != null ? js.getSkill().getName() : "")
                .collect(Collectors.joining(", "));

        return """
                Job Title: %s
                Department: %s
                Employment Type: %s
                Work Mode: %s
                Location: %s
                Experience Required: %s years
                Education Required: %s
                Skills: %s
                Job Description: %s
                """.formatted(
                job.getTitle(),
                job.getDepartment(),
                job.getEmploymentType(),
                job.getWorkMode(),
                job.getLocation(),
                job.getExperienceRequired(),
                job.getEducationRequired(),
                skills,
                job.getDescription()
        );
    }
}