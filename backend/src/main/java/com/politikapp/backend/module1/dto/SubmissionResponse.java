package com.politikapp.backend.module1.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SubmissionResponse(
        UUID submissionId,
        UUID politicianId,
        UUID contributorId,
        String sourceUrl,
        String categoryTag,
        String actionIdentifier,
        BigDecimal quantitativeMetric,
        String impactSummary,
        String status,
        String message,
        Instant createdAt
) {
}
