package com.project.ai_resumerag_be.entity;

import com.project.ai_resumerag_be.enums.InterviewRecommendation;
import com.project.ai_resumerag_be.enums.InterviewStatus;
import com.project.ai_resumerag_be.enums.InterviewType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "interviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Interview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterviewType type;

    @Column(nullable = false)
    private LocalDateTime scheduledAt;

    /** Length in minutes. */
    @Column(nullable = false)
    private Integer duration;

    @ElementCollection
    @CollectionTable(name = "interview_interviewers", joinColumns = @JoinColumn(name = "interview_id"))
    @Column(name = "interviewer")
    @Builder.Default
    private List<String> interviewers = new ArrayList<>();

    private String meetingLink;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterviewStatus status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Feedback, filled in after the interview.
    private Integer feedbackRating;

    @ElementCollection
    @CollectionTable(name = "interview_strengths", joinColumns = @JoinColumn(name = "interview_id"))
    @Column(name = "strength", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> feedbackStrengths = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "interview_weaknesses", joinColumns = @JoinColumn(name = "interview_id"))
    @Column(name = "weakness", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> feedbackWeaknesses = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private InterviewRecommendation feedbackRecommendation;

    @Column(columnDefinition = "TEXT")
    private String feedbackNotes;

    private LocalDateTime feedbackSubmittedAt;

    private String feedbackSubmittedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = InterviewStatus.SCHEDULED;
        }
    }

    public boolean hasFeedback() {
        return feedbackSubmittedAt != null;
    }
}
