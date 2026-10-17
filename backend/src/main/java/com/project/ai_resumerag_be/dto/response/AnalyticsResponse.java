package com.project.ai_resumerag_be.dto.response;

import java.util.List;
import java.util.Map;

/** Response shapes of the /analytics endpoints, matching what the frontend charts consume. */
public final class AnalyticsResponse {

    private AnalyticsResponse() {
    }

    public record Overview(long activeJobs, long totalCandidates, long shortlisted, long interviews, long offers) {
    }

    public record FunnelStage(String stage, long count, double conversionRate) {
    }

    public record JobDays(String jobTitle, double days) {
    }

    public record TimeToHire(double average, double median, List<JobDays> byJob) {
    }

    public record Range(String range, long count) {
    }

    public record AiMatchDistribution(List<Range> ranges) {
    }

    public record JobsMetrics(long total, long active, long draft, long closed, double avgApplicants,
                              double avgTimeToFill, long offersExtended, long hired,
                              Map<String, Long> byDepartment) {
    }
}
