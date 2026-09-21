package com.politikapp.backend.submission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record BallotSubmissionPayload(
        @NotNull java.util.UUID politicianId,
        java.util.UUID contributorId,
        @NotBlank @Size(max = 2048) String sourceUrl,
        @NotBlank @Size(max = 100) String categoryTag,
        @NotBlank @Size(max = 150) String actionIdentifier,
        Map<String, Object> actionDetails,
        @NotBlank @Size(max = 5000) String impactSummary
) {
}
