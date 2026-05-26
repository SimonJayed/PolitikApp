package com.politikapp.backend.module3.dto;

import java.util.UUID;

public record ContributorReputationResponse(
        UUID contributorId,
        double rejectionMetric,
        String accountStatus,
        String writingTokenStatus,
        boolean fallbackUsed,
        boolean locked,
        String message
) {
}
