package com.politikapp.backend.module1.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record TimelineEntryResponse(
        UUID timelineId,
        UUID politicianId,
        UUID submissionId,
        String categoryTag,
        String actionIdentifier,
        Map<String, Object> actionDetails,
        String summary,
        String sourceUrl,
        String publicationStatus,
        boolean isHidden,
        Instant createdAt
) {
}
