package com.project.ai_resumerag_be;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class AiResumeRagBeApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiResumeRagBeApplication.class, args);
    }

}
