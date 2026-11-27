package com.politikapp.backend.politician.dto;

import com.politikapp.backend.verification.CitationReviewService.Status;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record BudgetBreakdownResponse(String exactTotal, int recordCount, List<Allocation> allocations) {
    public record Allocation(UUID recordId, String title, String exactAmount, Integer fiscalYear,
            BigDecimal contributionPercentage, String sourceOrganization, String sourceUrl, Status verificationStatus) {}
}
