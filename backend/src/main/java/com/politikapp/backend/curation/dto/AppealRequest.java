package com.politikapp.backend.curation.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AppealRequest(
        @NotNull UUID submissionId,
        String details
) {
}
