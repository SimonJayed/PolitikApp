package com.politikapp.backend.module2.dto;

import java.time.Instant;
import java.util.UUID;

public record PendingQueueCardResponse(
    UUID queueId,
    UUID submissionId,
    UUID politicianId,
    String sourceUrl,
    String categoryTag,
    String actionIdentifier,
    String impactSummary,
    String queueStatus,
    boolean escalationFlag,
    Instant assignedAt,
    Instant createdAt
) {}
