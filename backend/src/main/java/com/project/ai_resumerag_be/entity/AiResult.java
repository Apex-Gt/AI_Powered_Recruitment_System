package com.project.ai_resumerag_be.entity;

import com.project.ai_resumerag_be.enumerators.AiResultType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Output produced by the AI service (candidate profile, match score, RAG summary, ranking),
 * stored as the JSON the service sent. One row per {@code refKey}; a newer result replaces the old one.
 */
@Entity
@Table(name = "ai_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String refKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AiResultType type;

    private UUID candidateId;

    private UUID jobId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }
}
