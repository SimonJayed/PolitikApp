package com.politikapp.backend.politician.service;

import com.politikapp.backend.politician.dto.PoliticianResponse;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WgiLeaderboardService {
    public record Entry(int rank, UUID politicianId, String fullName, String position, String jurisdiction,
                        String profileImageUrl, double wgiCompositeScore, Instant sourceUpdatedAt) {}
    public record Page(List<Entry> entries, int totalRanked, long unrankedCount, int offset, int limit,
                       boolean hasMore, Instant calculatedAt) {}
    private record Scored(PoliticianResponse profile, Instant sourceUpdatedAt) {}
    private static final Set<String> ACTIONS = Set.of("SPONSORED_LEGISLATION", "PROJECT_COMPLETION", "BUDGET_ALLOCATION", "COA_FINDING");
    private final PoliticianRepository politicians;
    private final ProfileEditSubmissionRepository submissions;
    private final DashboardMetricsService metrics;
    private final PoliticianMapper mapper;

    public WgiLeaderboardService(PoliticianRepository politicians, ProfileEditSubmissionRepository submissions,
            DashboardMetricsService metrics, PoliticianMapper mapper) {
        this.politicians = politicians;
        this.submissions = submissions;
        this.metrics = metrics;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Page leaderboard(int offset, int limit) {
        // Scores are derived, not stored. Fetch only profiles with potential scoring records,
        // then use the same batch inputs and scorer as directory/profile responses.
        List<Politician> candidates = politicians.findWgiCandidates();
        var published = candidates.isEmpty() ? Map.<UUID, List<ProfileEditSubmission>>of()
                : submissions.findByPoliticianIdInAndStatus(candidates.stream().map(Politician::getPoliticianId).toList(), "PUBLISHED")
                    .stream().collect(Collectors.groupingBy(ProfileEditSubmission::getPoliticianId));
        var timelines = metrics.verifiedTimelines(candidates);
        var scored = new ArrayList<Scored>();
        for (Politician person : candidates) {
            var raw = published.getOrDefault(person.getPoliticianId(), List.of());
            var entries = timelines.getOrDefault(person.getPoliticianId(), List.of());
            var records = metrics.includeVerifiedTimeline(raw, entries).stream()
                    .filter(record -> eligible(record.getActionIdentifier(), person.getPosition())).toList();
            // Default numeric zero on an empty profile is not evidence of a calculated score.
            if (records.isEmpty()) continue;
            PoliticianResponse response = mapper.toResponseWithRecords(person, records);
            double score = response.wgiCompositeScore();
            if (!Double.isFinite(score) || score < 0 || score > 100) continue;
            Instant updated = Stream.concat(
                    raw.stream().filter(record -> eligible(record.getActionIdentifier(), person.getPosition()))
                            .map(record -> latest(record.getUpdatedAt(), record.getCreatedAt())),
                    entries.stream().filter(entry -> entry.getSubmissionId() == null
                            && (entry.getActionDetails() == null || !Boolean.TRUE.equals(entry.getActionDetails().get("sourceReported")))
                            && eligible(entry.getActionIdentifier(), person.getPosition()))
                            .map(entry -> latest(entry.getUpdatedAt(), entry.getCreatedAt())))
                    .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
            scored.add(new Scored(response, updated));
        }
        // Restore the old panel's WGI tie-breaks: bills, projects, budget, fewer COA flags,
        // then name. UUID makes otherwise identical records deterministic.
        scored.sort(Comparator.<Scored>comparingDouble(row -> row.profile().wgiCompositeScore()).reversed()
                .thenComparing(Comparator.comparingLong((Scored row) -> row.profile().billsAuthored()).reversed())
                .thenComparing(Comparator.comparingLong((Scored row) -> row.profile().projectCompletions()).reversed())
                .thenComparing((left, right) -> right.profile().trackedBudgetAllocated().compareTo(left.profile().trackedBudgetAllocated()))
                .thenComparingInt(row -> row.profile().coaAuditDiscrepancies())
                .thenComparing(row -> row.profile().fullName(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(row -> row.profile().politicianId()));
        int start = Math.min(Math.max(0, offset), scored.size());
        int size = Math.max(1, Math.min(50, limit));
        int end = Math.min(start + size, scored.size());
        var result = new ArrayList<Entry>();
        for (int index = start; index < end; index++) {
            var row = scored.get(index);
            var p = row.profile();
            result.add(new Entry(index + 1, p.politicianId(), p.fullName(), p.position(), p.jurisdiction(),
                    p.profileImageUrl(), p.wgiCompositeScore(), row.sourceUpdatedAt()));
        }
        return new Page(result, scored.size(), Math.max(0, politicians.countPublicProfiles() - scored.size()),
                start, size, end < scored.size(), Instant.now());
    }

    private boolean eligible(String action, String position) {
        return ACTIONS.contains(action == null ? "" : action) && metrics.isActionAllowedForPosition(action, position);
    }
    private static Instant latest(Instant updated, Instant created) { return updated == null ? created : updated; }
}
