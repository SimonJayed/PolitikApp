package com.politikapp.backend.module1.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record BallotSubmissionPayload(
        @NotNull UUID politicianId,
        @NotNull UUID contributorId,
        @NotBlank String sourceUrl,
        @NotBlank @Size(max = 100) String categoryTag,
        @NotBlank @Size(max = 150) String actionIdentifier,
        @NotNull @DecimalMin("0.00") BigDecimal quantitativeMetric,
        @NotBlank String impactSummary
) {
}
