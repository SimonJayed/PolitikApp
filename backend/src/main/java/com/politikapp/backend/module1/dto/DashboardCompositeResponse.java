package com.politikapp.backend.module1.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DashboardCompositeResponse(
        UUID politicianId,
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        String profileImageUrl,
        String biography,
        double billsAuthored,
        double projectCompletions,
        double legislativeEfficiencyRatio,
        int coaAuditDiscrepancies,
        BigDecimal trackedBudgetAllocated,
        double wgiCompositeScore,
        List<TimelineEntryResponse> publishedTimelineLedger
) {
}
