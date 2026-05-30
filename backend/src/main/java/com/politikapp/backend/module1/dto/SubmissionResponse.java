package com.politikapp.backend.module1.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record SubmissionResponse(
        UUID submissionId,
        UUID politicianId,
        UUID contributorId,
        String sourceUrl,
        String categoryTag,
        String actionIdentifier,
        Map<String, Object> actionDetails,
        String impactSummary,
        String status,
        String message,
        Instant createdAt
) {
}
