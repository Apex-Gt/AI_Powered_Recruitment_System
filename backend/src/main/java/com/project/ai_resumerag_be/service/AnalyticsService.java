package com.project.ai_resumerag_be.service;

import tools.jackson.databind.ObjectMapper;
import com.project.ai_resumerag_be.dto.response.AnalyticsResponse.*;
import com.project.ai_resumerag_be.entity.AiResult;
import com.project.ai_resumerag_be.entity.Candidate;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enums.AiResultType;
import com.project.ai_resumerag_be.enums.ApplicationStatus;
import com.project.ai_resumerag_be.enums.JobStatus;
import com.project.ai_resumerag_be.enums.Role;
import com.project.ai_resumerag_be.repository.AiResultRepository;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.repository.JobRepository;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Recruitment metrics computed from existing data. Admins see their whole company,
 * recruiters only the jobs they created.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsService {

    /** Funnel order. REJECTED candidates only count towards "Applied". */
    private static final List<ApplicationStatus> FUNNEL = List.of(
            ApplicationStatus.APPLIED, ApplicationStatus.SCREENING, ApplicationStatus.SHORTLISTED,
            ApplicationStatus.INTERVIEW, ApplicationStatus.SELECTED);

    private final JobRepository jobRepository;
    private final CandidateRepository candidateRepository;
    private final AiResultRepository aiResultRepository;
    private final ObjectMapper objectMapper;

    public Overview overview() {
        List<Job> jobs = visibleJobs();
        List<Candidate> candidates = candidatesOf(jobs);
        return new Overview(
                jobs.stream().filter(j -> j.getStatus() == JobStatus.OPEN).count(),
                candidates.size(),
                reached(candidates, ApplicationStatus.SHORTLISTED),
                reached(candidates, ApplicationStatus.INTERVIEW),
                count(candidates, ApplicationStatus.SELECTED));
    }

    public List<FunnelStage> funnel() {
        List<Candidate> candidates = candidatesOf(visibleJobs());
        List<FunnelStage> stages = new ArrayList<>();
        long previous = 0;
        for (ApplicationStatus stage : FUNNEL) {
            long count = stage == ApplicationStatus.APPLIED ? candidates.size() : reached(candidates, stage);
            double rate = stages.isEmpty() ? (count > 0 ? 100 : 0) : (previous > 0 ? round1(count * 100.0 / previous) : 0);
            stages.add(new FunnelStage(label(stage), count, rate));
            previous = count;
        }
        return stages;
    }

    public TimeToHire timeToHire() {
        List<Candidate> selected = candidatesOf(visibleJobs()).stream()
                .filter(c -> c.getStatus() == ApplicationStatus.SELECTED && c.getStatusChangedAt() != null)
                .toList();

        List<Double> days = selected.stream().map(this::daysToHire).sorted().toList();
        double average = days.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double median = days.isEmpty() ? 0
                : days.size() % 2 == 1 ? days.get(days.size() / 2)
                : (days.get(days.size() / 2 - 1) + days.get(days.size() / 2)) / 2;

        Map<String, Double> perJob = selected.stream().collect(Collectors.groupingBy(
                c -> c.getJob().getTitle(), TreeMap::new, Collectors.averagingDouble(this::daysToHire)));
        List<JobDays> byJob = perJob.entrySet().stream().map(e -> new JobDays(e.getKey(), round1(e.getValue()))).toList();
        return new TimeToHire(round1(average), round1(median), byJob);
    }

    public AiMatchDistribution aiMatchDistribution() {
        List<Job> jobs = visibleJobs();
        long high = 0, good = 0, fair = 0, low = 0;
        if (!jobs.isEmpty()) {
            for (AiResult row : aiResultRepository.findByTypeAndJobIdIn(AiResultType.MATCH_SCORE,
                    jobs.stream().map(Job::getId).toList())) {
                double score = scoreOf(row);
                if (score >= 80) high++;
                else if (score >= 60) good++;
                else if (score >= 40) fair++;
                else low++;
            }
        }
        return new AiMatchDistribution(List.of(
                new Range("80-100%", high), new Range("60-79%", good),
                new Range("40-59%", fair), new Range("0-39%", low)));
    }

    public JobsMetrics jobsMetrics() {
        List<Job> jobs = visibleJobs();
        List<Candidate> candidates = candidatesOf(jobs);
        long selected = count(candidates, ApplicationStatus.SELECTED);
        Map<String, Long> byDepartment = jobs.stream().collect(Collectors.groupingBy(
                j -> j.getDepartment() == null || j.getDepartment().isBlank() ? "Other" : j.getDepartment(),
                TreeMap::new, Collectors.counting()));
        return new JobsMetrics(
                jobs.size(),
                jobs.stream().filter(j -> j.getStatus() == JobStatus.OPEN).count(),
                jobs.stream().filter(j -> j.getStatus() == JobStatus.DRAFT).count(),
                jobs.stream().filter(j -> j.getStatus() == JobStatus.CLOSED).count(),
                jobs.isEmpty() ? 0 : round1((double) candidates.size() / jobs.size()),
                timeToHire().average(),
                selected, selected, byDepartment);
    }

    // -- helpers ---------------------------------------------------------------

    private List<Job> visibleJobs() {
        User user = ((CustomUserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getUser();
        if (user.getCompany() == null) {
            return List.of();
        }
        return user.getRole() == Role.ADMIN ? jobRepository.findByCompany(user.getCompany()) : jobRepository.findByCreatedBy(user);
    }

    private List<Candidate> candidatesOf(List<Job> jobs) {
        return jobs.isEmpty() ? List.of() : candidateRepository.findByJobIdIn(jobs.stream().map(Job::getId).toList());
    }

    private static long count(List<Candidate> candidates, ApplicationStatus status) {
        return candidates.stream().filter(c -> c.getStatus() == status).count();
    }

    /** Candidates that got at least as far as {@code stage} (rejected ones excluded). */
    private static long reached(List<Candidate> candidates, ApplicationStatus stage) {
        int index = FUNNEL.indexOf(stage);
        return candidates.stream()
                .filter(c -> FUNNEL.indexOf(c.getStatus()) >= index)
                .count();
    }

    private double daysToHire(Candidate c) {
        return Duration.between(c.getAppliedAt(), c.getStatusChangedAt()).toMinutes() / (60.0 * 24.0);
    }

    private double scoreOf(AiResult row) {
        try {
            return objectMapper.readTree(row.getPayload()).path("overallScore").asDouble(0);
        } catch (Exception e) {
            return 0;
        }
    }

    private static String label(ApplicationStatus status) {
        String name = status.name();
        return name.charAt(0) + name.substring(1).toLowerCase();
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
