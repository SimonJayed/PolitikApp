package com.politikapp.backend.module1.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TimelineEntryResponse(
        UUID timelineId,
        UUID politicianId,
        String categoryTag,
        String actionIdentifier,
        BigDecimal quantitativeMetric,
        String summary,
        String sourceUrl,
        String publicationStatus,
        Instant createdAt
) {
}
