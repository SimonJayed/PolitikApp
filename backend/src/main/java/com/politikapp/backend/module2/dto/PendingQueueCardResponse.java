package com.politikapp.backend.module2.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PendingQueueCardResponse(
    UUID queueId,
    UUID submissionId,
    UUID politicianId,
    String politicianName,
    String contributorName,
    String sourceUrl,
    String categoryTag,
    String actionIdentifier,
    String actionDetailsJson,
    String impactSummary,
    String jurisdiction,
    String politicianStatus,
    LocalDate termStart,
    LocalDate termEnd,
    String queueStatus,
    boolean escalationFlag,
    Instant assignedAt,
    Instant createdAt
) {}
