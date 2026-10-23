package com.project.ai_resumerag_be.entity;

import com.project.ai_resumerag_be.enums.ApplicationStatus;
import jakarta.persistence.Entity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "resumes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private String fileUrl;

    @Column(columnDefinition = "TEXT")
    private String extractedText;

    /** SHA-256 of the stored file; set by the batch pipeline (older rows have none). */
    @Column(length = 64)
    private String sha256;

    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
