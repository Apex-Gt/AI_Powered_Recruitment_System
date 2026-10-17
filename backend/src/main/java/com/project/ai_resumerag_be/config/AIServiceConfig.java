package com.project.ai_resumerag_be.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class AIServiceConfig {

    @Value("${ai-service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    @Value("${ai-service.timeout:300000}")
    private int timeout;

    @Bean
    public WebClient aiServiceWebClient() {
        return WebClient.builder()
                .baseUrl(aiServiceBaseUrl)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }
}