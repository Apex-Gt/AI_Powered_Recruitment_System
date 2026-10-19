package com.project.ai_resumerag_be.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * One stage of an assessment. Rounds are taken in order, each with its own time limit; the questions that belong
 * to a round point back at it through {@link AssessmentQuestion#getRound()}.
 */
@Entity
@Table(name = "assessment_rounds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentRound {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @Column(nullable = false)
    private Integer position;

    @Column(nullable = false)
    private String title;

    /** What the candidate is told about this round before it starts. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** Time limit in minutes once the candidate starts this round. */
    @Column(nullable = false)
    private Integer durationMinutes;
}
