package com.politikapp.backend.module1.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record TimelineEntryResponse(
        UUID timelineId,
        UUID politicianId,
        String categoryTag,
        String actionIdentifier,
        Map<String, Object> actionDetails,
        String summary,
        String sourceUrl,
        String publicationStatus,
        Instant createdAt
) {
}
