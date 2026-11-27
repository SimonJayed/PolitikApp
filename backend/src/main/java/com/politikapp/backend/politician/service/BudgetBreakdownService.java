package com.politikapp.backend.politician.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.dto.BudgetBreakdownResponse;
import com.politikapp.backend.politician.dto.BudgetBreakdownResponse.Allocation;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import com.politikapp.backend.submission.service.CitationUrls;
import com.politikapp.backend.verification.CitationReviewService;
import com.politikapp.backend.verification.CitationReviewService.PublicReview;
import com.politikapp.backend.verification.CitationReviewService.RecordType;
import com.politikapp.backend.verification.CitationReviewService.Status;
import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetBreakdownService {
    private static final Pattern EXPLICIT_YEAR = Pattern.compile(
            "(?i)\\b(?:FY|fiscal\\s+year)\\s*((?:19|20)\\d{2})\\b"
                    + "(\\s*[-–—/]\\s*\\d|\\s+(?:and|to|through)\\s+(?:(?:FY|fiscal\\s+year)\\s*)?\\d)?");
    private final PoliticianRepository politicians;
    private final ProfileEditSubmissionRepository submissions;
    private final TimelineEntryRepository timelines;
    private final DashboardMetricsService metrics;
    private final CitationReviewService citationReviews;
    private final boolean citationReviewsEnabled;

    public BudgetBreakdownService(PoliticianRepository politicians, ProfileEditSubmissionRepository submissions,
            TimelineEntryRepository timelines, DashboardMetricsService metrics, CitationReviewService citationReviews,
            @Value("${app.citation-reviews.enabled:false}") boolean citationReviewsEnabled) {
        this.politicians = politicians;
        this.submissions = submissions;
        this.timelines = timelines;
        this.metrics = metrics;
        this.citationReviews = citationReviews;
        this.citationReviewsEnabled = citationReviewsEnabled;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public BudgetBreakdownResponse get(UUID politicianId) {
        var politician = politicians.findById(politicianId).filter(p -> !"ARCHIVED".equals(p.getStatus()))
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found."));
        if (!metrics.isActionAllowedForPosition("BUDGET_ALLOCATION", politician.getPosition())) {
            return new BudgetBreakdownResponse("0", 0, List.of());
        }
        var ledger = timelines.findActiveEntries(politicianId, "PUBLISHED");
        var contributions = metrics.budgetContributions(metrics.includeVerifiedTimeline(
                submissions.findByPoliticianIdAndStatus(politicianId, "PUBLISHED"), ledger));
        var total = DashboardMetricsService.sumBudgetContributions(contributions);
        var publicReviews = citationReviewsEnabled && !contributions.isEmpty()
                ? citationReviews.publicReviews(politicianId).stream().filter(review -> review.type() == RecordType.TIMELINE)
                    .collect(Collectors.toMap(PublicReview::id, Function.identity()))
                : Map.<UUID, PublicReview>of();
        var budgetLedger = ledger.stream().filter(entry -> "BUDGET_ALLOCATION".equals(entry.getActionIdentifier()))
                .collect(Collectors.groupingBy(entry -> entry.getSubmissionId() == null ? entry.getTimelineId() : entry.getSubmissionId()));
        var allocations = contributions.stream()
                .sorted(Comparator.comparing(DashboardMetricsService.BudgetContribution::amount).reversed()
                        .thenComparing(contribution -> contribution.record().getSubmissionId()))
                .map(contribution -> allocation(contribution, total, budgetLedger, publicReviews))
                .toList();
        return new BudgetBreakdownResponse(total.toPlainString(), allocations.size(), allocations);
    }

    private Allocation allocation(DashboardMetricsService.BudgetContribution contribution, BigDecimal total,
            Map<UUID, List<TimelineEntry>> ledger, Map<UUID, PublicReview> publicReviews) {
        var submission = contribution.record();
        var details = submission.getActionDetails();
        // A review of a conflicting timeline cannot establish the amount or description counted by the submission.
        var review = ledger.getOrDefault(submission.getSubmissionId(), List.of()).stream()
                .filter(entry -> Objects.equals(clean(entry.getSummary()), clean(submission.getImpactSummary()))
                        && Objects.equals(clean(entry.getSourceUrl()), clean(submission.getSourceUrl()))
                        && DashboardMetricsService.allocationAmount(entry.getActionDetails()).compareTo(contribution.amount()) == 0)
                .map(entry -> publicReviews.get(entry.getTimelineId())).filter(Objects::nonNull).findFirst().orElse(null);
        var status = review == null ? Status.UNVERIFIED : review.status();
        String source = status == Status.INVALID_SOURCE ? null
                : status == Status.VERIFIED ? first(review.sourceUrl(), submission.getSourceUrl()) : submission.getSourceUrl();
        String organization = first(review == null ? null : review.sourceOrganization(), clean(details.get("sourceOrganization")));
        String description = clean(submission.getImpactSummary());
        String title = first(clean(details.get("allocationTitle")), clean(details.get("budgetTitle")),
                clean(details.get("projectTitle")), clean(details.get("title")), description);
        BigDecimal percent = total.signum() == 0 ? null
                : contribution.amount().movePointRight(2).divide(total, MathContext.DECIMAL128);
        return new Allocation(submission.getSubmissionId(), title, contribution.amount().toPlainString(),
                fiscalYear(details, description), percent, organization,
                CitationUrls.isWebUrl(source) ? source.trim() : null, status);
    }

    private static Integer fiscalYear(Map<String, Object> details, String description) {
        String year = clean(details.get("fiscalYear"));
        if (year != null && year.matches("(?:19|20)\\d{2}")) return Integer.valueOf(year);
        if (description == null) return null;
        var match = EXPLICIT_YEAR.matcher(description);
        if (!match.find()) return null;
        if (match.group(2) != null) return null;
        int found = Integer.parseInt(match.group(1));
        while (match.find()) {
            if (match.group(2) != null || Integer.parseInt(match.group(1)) != found) return null;
        }
        return found;
    }

    private static String first(String... values) {
        for (String value : values) {
            String cleaned = clean(value);
            if (cleaned != null) return cleaned;
        }
        return null;
    }

    private static String clean(Object value) {
        if (value instanceof String str && !str.isBlank()) return str.strip();
        if (value instanceof Number number) return number.toString();
        return null;
    }
}
