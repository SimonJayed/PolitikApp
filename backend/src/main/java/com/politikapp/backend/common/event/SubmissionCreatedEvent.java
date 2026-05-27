package com.politikapp.backend.common.event;

import java.util.Map;
import java.util.UUID;

/**
 * Shared immutable event payload to decouple Module 1 Submission processing
 * from Module 2 Moderation queueing.
 */
public record SubmissionCreatedEvent(
    UUID submissionId,
    UUID politicianId,
    UUID contributorId,
    String sourceUrl,
    String categoryTag,
    String actionIdentifier,
    Map<String, Object> actionDetails,
    String impactSummary
) {}
