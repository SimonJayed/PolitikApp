package com.politikapp.backend.module2.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class AdminCurationDtos {

    public record AdminMetricUpsertRequest(
            @NotNull(message = "politicianId is required") UUID politicianId,
            @NotBlank(message = "categoryTag is required") String categoryTag,
            @NotBlank(message = "actionIdentifier is required") String actionIdentifier,
            Map<String, Object> actionDetails,
            @NotBlank(message = "impactSummary is required") String impactSummary,
            @NotBlank(message = "primarySourceUrl is required and must be a valid citation") String primarySourceUrl,
            String verificationNotes
    ) {}

    public record PublicChallengeRequest(
            @NotNull(message = "challengeTargetId is required") UUID challengeTargetId,
            @NotNull(message = "politicianId is required") UUID politicianId,
            @NotBlank(message = "challengeReason is required") String challengeReason,
            @NotBlank(message = "evidenceUrl is required") String evidenceUrl
    ) {}

    public record AdjudicationTransitionRequest(
            @NotBlank(message = "targetStatus is required") String targetStatus,
            @NotBlank(message = "adminResolutionNotes is required") String adminResolutionNotes
    ) {}

    public record AdjudicationQueueCardResponse(
            UUID queueId,
            UUID submissionId,
            UUID politicianId,
            String politicianName,
            String queueStatus,
            String itemType,
            String categoryTag,
            String actionIdentifier,
            Map<String, Object> actionDetails,
            String summary,
            String primarySourceUrl,
            UUID challengeTargetId,
            String challengeReason,
            String evidenceUrl,
            String adminResolutionNotes,
            Instant resolvedAt,
            Instant createdAt
    ) {}

    public record CitizenContentRequest(
            @NotNull(message = "politicianId is required") UUID politicianId,
            @NotBlank(message = "categoryTag is required") String categoryTag,
            @NotBlank(message = "actionIdentifier is required") String actionIdentifier,
            Map<String, Object> actionDetails,
            @NotBlank(message = "impactSummary is required") String impactSummary,
            @NotBlank(message = "primarySourceUrl is required") String primarySourceUrl
    ) {}
}
