package com.project.ai_resumerag_be.entity;

import com.project.ai_resumerag_be.enumerators.AssessmentStatus;
import com.project.ai_resumerag_be.enumerators.AssessmentType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Assessment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssessmentType type;

    /** Total time limit in minutes: the sum of the round time limits. */
    @Column(nullable = false)
    private Integer duration;

    /** Shown to the candidate before the test starts. */
    @Column(columnDefinition = "TEXT")
    private String about;

    /** Shown to the candidate before the test starts; they must accept it to begin. */
    @Column(columnDefinition = "TEXT")
    private String termsAndConditions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssessmentStatus status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    /** Optional: the job this assessment was built for. Null means a general, company-wide assessment. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id")
    private Job job;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @OneToMany(mappedBy = "assessment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<AssessmentQuestion> questions = new ArrayList<>();

    @OneToMany(mappedBy = "assessment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<AssessmentRound> rounds = new ArrayList<>();

    /**
     * The rounds as the candidate experiences them. An assessment created before rounds existed has none stored,
     * so it reads as a single round holding every question and the whole time limit.
     */
    public List<AssessmentRound> effectiveRounds() {
        if (!rounds.isEmpty()) {
            return rounds;
        }
        return List.of(AssessmentRound.builder().assessment(this).position(0).title("Round 1").durationMinutes(duration).build());
    }

    /** The questions of one of {@link #effectiveRounds()}, in order. */
    public List<AssessmentQuestion> questionsOf(AssessmentRound round) {
        if (rounds.isEmpty()) {
            return questions;
        }
        return questions.stream()
                .filter(q -> q.getRound() == round
                        || (q.getRound() != null && round.getId() != null && round.getId().equals(q.getRound().getId())))
                .toList();
    }

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = AssessmentStatus.ACTIVE;
        }
    }
}
