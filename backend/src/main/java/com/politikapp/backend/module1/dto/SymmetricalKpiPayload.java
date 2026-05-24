package com.politikapp.backend.module1.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SymmetricalKpiPayload(
        UUID politicianId,
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        long billsAuthored,
        long projectCompletions,
        int coaAuditDiscrepancies,
        BigDecimal trackedBudgetAllocated,
        double legislativeEfficiencyRatio
) {
}
