package com.project.ai_resumerag_be.entity;

import com.project.ai_resumerag_be.enumerators.EmploymentType;
import com.project.ai_resumerag_be.enumerators.JobStatus;
import com.project.ai_resumerag_be.enumerators.WorkMode;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "jobs",
        indexes = {
                @Index(name = "idx_job_title", columnList = "title"),
                @Index(name = "idx_job_status", columnList = "status"),
                @Index(name = "idx_job_company", columnList = "company_id"),
                @Index(name = "idx_job_created_by", columnList = "created_by")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToMany(
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @JoinColumn(name = "job_id")
    @Builder.Default
    private List<JobSkill> skills = new ArrayList<>();


    @NotBlank(message = "Job title is required")
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String title;

    @NotBlank(message = "Department is required")
    @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmploymentType employmentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WorkMode workMode;

    @NotBlank(message = "Location is required")
    @Size(max = 150)
    @Column(nullable = false)
    private String location;


    @NotNull
    @Min(value = 0, message = "experience is required")
    @Column(nullable = false)
    private Integer experienceRequired;

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false)
    private String educationRequired;

    @DecimalMin(value = "0.0")
    @Column(precision = 12, scale = 2)
    private BigDecimal minimumSalary;

    @DecimalMin(value = "0.0")
    @Column(precision = 12, scale = 2)
    private BigDecimal maximumSalary;

    @NotBlank(message = "Job description is required")
    @Lob
    @Column(nullable = false)
    private String description;

    @Column(length = 500)
    private String jdFilePath;

    @Column(columnDefinition = "vector(768)")
    private float[] jdEmbedding;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobStatus status;

    @FutureOrPresent
    private LocalDate applicationDeadline;

    @Positive
    private Integer vacancies;

    @Positive
    private String salaryCurrency;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @AssertTrue(message = "Experience must be between 0 and 80 years")
    public boolean isExperienceValid() {
        return experienceRequired != null
                && experienceRequired >= 0
                && experienceRequired <= 80;
    }

    @AssertTrue(message = "Maximum salary must be greater than or equal to minimum salary")
    public boolean isSalaryValid() {
        if (minimumSalary == null || maximumSalary == null) {
            return true;
        }
        return maximumSalary.compareTo(minimumSalary) >= 0;
    }

    
}