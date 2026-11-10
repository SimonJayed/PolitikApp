package com.politikapp.backend.politician.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DashboardCompositeResponse(
        UUID politicianId,
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        java.time.LocalDate termStart,
        java.time.LocalDate termEnd,
        String profileImageUrl,
        String biography,
        double billsAuthored,
        double projectCompletions,
        double legislativeEfficiencyRatio,
        int coaAuditDiscrepancies,
        BigDecimal trackedBudgetAllocated,
        double wgiCompositeScore,
        List<TimelineEntryResponse> publishedTimelineLedger,
        List<ProfileNewsItem> relatedNews,
        String profileOrigin
) {
    public record ProfileNewsItem(UUID id, String headline, String sourceName, String sourceUrl,
                                  String summary, java.time.Instant publishedAt) {}
}
