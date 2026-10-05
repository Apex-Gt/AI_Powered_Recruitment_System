package com.project.ai_resumerag_be.service;

import com.project.ai_resumerag_be.entity.Job;

public interface EmbeddingService {
    float[] generateJobEmbedding(Job job);
}
