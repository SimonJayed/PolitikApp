package com.politikapp.backend.politician.service;

import com.politikapp.backend.politician.dto.PoliticianResponse;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class PoliticianMapper {
    private final ProfileEditSubmissionRepository submissionRepository;
    private final DashboardMetricsService dashboardMetricsService;

    public PoliticianMapper(
            ProfileEditSubmissionRepository submissionRepository,
            DashboardMetricsService dashboardMetricsService
    ) {
        this.submissionRepository = submissionRepository;
        this.dashboardMetricsService = dashboardMetricsService;
    }

    public PoliticianResponse toResponse(Politician politician) {
        List<ProfileEditSubmission> rawSubmissions = submissionRepository
                .findByPoliticianIdAndStatus(politician.getPoliticianId(), "PUBLISHED");
        return toResponse(politician, rawSubmissions);
    }

    public PoliticianResponse toResponse(Politician politician, List<ProfileEditSubmission> rawSubmissions) {
        List<ProfileEditSubmission> safeRaw = rawSubmissions != null ? rawSubmissions : Collections.emptyList();
        return toResponseWithRecords(politician, dashboardMetricsService.includeVerifiedTimeline(politician, safeRaw));
    }

    public List<PoliticianResponse> toResponses(List<Politician> politicians,
            Map<java.util.UUID, List<ProfileEditSubmission>> submissionsByPolitician) {
        var timelines = dashboardMetricsService.verifiedTimelines(politicians);
        return politicians.stream().map(p -> toResponseWithRecords(p, dashboardMetricsService.includeVerifiedTimeline(
                submissionsByPolitician.getOrDefault(p.getPoliticianId(), List.of()),
                timelines.getOrDefault(p.getPoliticianId(), List.of())))).toList();
    }

    PoliticianResponse toResponseWithRecords(Politician politician, List<ProfileEditSubmission> records) {
        List<ProfileEditSubmission> submissions = records.stream()
                .filter(sub -> dashboardMetricsService.isActionAllowedForPosition(sub.getActionIdentifier(), politician.getPosition()))
                .toList();

        long billsAuthored = countByAction(submissions, "SPONSORED_LEGISLATION");
        long projectCompletions = countByAction(submissions, "PROJECT_COMPLETION");
        int coaDiscrepancies = Math.toIntExact(countByAction(submissions, "COA_FINDING"));

        BigDecimal totalBudget = dashboardMetricsService.trackedBudget(submissions);

        double efficiencyRatio = 0.0;
        try {
            if (billsAuthored > 0) {
                efficiencyRatio = ((double) projectCompletions / billsAuthored) * 100.0;
            }
        } catch (ArithmeticException | NullPointerException e) {
            efficiencyRatio = 0.0;
        }

        double effBills = dashboardMetricsService.sumEffectiveLegislation(submissions);
        double effProjects = dashboardMetricsService.sumEffectiveProjects(submissions);
        BigDecimal totalFlagged = dashboardMetricsService.sumFlaggedAmount(submissions);

        Double wgiScore = submissions.isEmpty() && DashboardMetricsService.isNationalExecutive(politician.getPosition())
                ? null : dashboardMetricsService.computeWgiCompositeScore(
                politician.getPosition(),
                effBills,
                effProjects,
                totalBudget,
                totalFlagged,
                coaDiscrepancies
        );

        return new PoliticianResponse(
                politician.getPoliticianId(),
                clean(politician.getFullName()),
                clean(politician.getPosition()),
                canonicalCode(politician.getJurisdiction()),
                clean(politician.getPartyAffiliation()),
                politician.getTermStart(),
                politician.getTermEnd(),
                clean(politician.getProfileImageUrl()),
                clean(politician.getBiography()),
                canonicalCode(politician.getStatus()),
                efficiencyRatio,
                coaDiscrepancies,
                totalBudget,
                billsAuthored,
                projectCompletions,
                wgiScore,
                politician.getProfileOrigin()
        );
    }

    private long countByAction(List<ProfileEditSubmission> submissions, String actionIdentifier) {
        return submissions.stream()
                .filter(submission -> actionIdentifier.equals(submission.getActionIdentifier()))
                .count();
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    private String canonicalCode(String value) {
        String cleaned = clean(value);
        if (cleaned == null || cleaned.isBlank()) {
            return cleaned;
        }
        return cleaned
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }
}
