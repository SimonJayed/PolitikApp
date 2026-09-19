package com.politikapp.backend.politician.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SymmetricalKpiPayload(
        UUID politicianId,
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        double billsAuthored,
        double projectCompletions,
        int coaAuditDiscrepancies,
        BigDecimal trackedBudgetAllocated,
        double legislativeEfficiencyRatio,
        double wgiCompositeScore
) {
}
