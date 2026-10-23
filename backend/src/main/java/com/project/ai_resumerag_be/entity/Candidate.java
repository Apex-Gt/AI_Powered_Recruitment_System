package com.project.ai_resumerag_be.entity;

import com.project.ai_resumerag_be.enums.ApplicationStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "candidates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Candidate {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String candidateName;

    @Column(nullable = false)
    private String candidateEmail;

    private String phoneNumber;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime appliedAt;

    /** When {@link #status} last changed; used for time-to-hire analytics. */
    private LocalDateTime statusChangedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id", nullable = false)
    private Resume resume;

    @PrePersist
    protected void onCreate() {
        appliedAt = LocalDateTime.now();
        statusChangedAt = appliedAt;

        if (status == null) {
            status = ApplicationStatus.APPLIED;
        }
    }

    public void setStatus(ApplicationStatus status) {
        if (this.status != status) {
            this.statusChangedAt = LocalDateTime.now();
        }
        this.status = status;
    }
}
