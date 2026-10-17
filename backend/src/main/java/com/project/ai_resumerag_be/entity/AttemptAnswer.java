package com.project.ai_resumerag_be.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "attempt_answers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttemptAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private AssessmentAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private AssessmentQuestion question;

    @Column(columnDefinition = "TEXT")
    private String answer;

    /** 0-100, null until graded (automatically or by a recruiter). */
    private Double score;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    /** True when automatic grading was not possible and a recruiter must score this answer. */
    @Column(nullable = false)
    private boolean needsReview;
}
