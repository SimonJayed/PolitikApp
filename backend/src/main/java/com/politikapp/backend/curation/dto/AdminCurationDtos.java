package com.politikapp.backend.curation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class AdminCurationDtos {

    public record AdminMetricUpsertRequest(
            @NotNull(message = "politicianId is required") UUID politicianId,
            @NotBlank(message = "categoryTag is required") @Size(max = 100) String categoryTag,
            @NotBlank(message = "actionIdentifier is required") @Size(max = 150) String actionIdentifier,
            Map<String, Object> actionDetails,
            @NotBlank(message = "impactSummary is required") @Size(max = 5000) String impactSummary,
            @NotBlank(message = "primarySourceUrl is required and must be a valid citation") @Size(max = 2048) String primarySourceUrl,
            @Size(max = 5000) String verificationNotes
    ) {}

    public record PublicChallengeRequest(
            @NotNull(message = "challengeTargetId is required") UUID challengeTargetId,
            @NotNull(message = "politicianId is required") UUID politicianId,
            @NotBlank(message = "challengeReason is required") @Size(max = 5000) String challengeReason,
            @NotBlank(message = "evidenceUrl is required") @Size(max = 2048) String evidenceUrl
    ) {}

    public record AdjudicationTransitionRequest(
            @NotBlank(message = "targetStatus is required") @Size(max = 50) String targetStatus,
            @NotBlank(message = "adminResolutionNotes is required") @Size(max = 5000) String adminResolutionNotes
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
            @NotBlank(message = "categoryTag is required") @Size(max = 100) String categoryTag,
            @NotBlank(message = "actionIdentifier is required") @Size(max = 150) String actionIdentifier,
            Map<String, Object> actionDetails,
            @NotBlank(message = "impactSummary is required") @Size(max = 5000) String impactSummary,
            @NotBlank(message = "primarySourceUrl is required") @Size(max = 2048) String primarySourceUrl
    ) {}
}
