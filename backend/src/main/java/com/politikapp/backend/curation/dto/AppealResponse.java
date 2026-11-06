package com.politikapp.backend.curation.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record AppealResponse(
        String message,
        UUID submissionId,
        UUID queueId,
        String status,
        BigDecimal trustScore
) {
}
