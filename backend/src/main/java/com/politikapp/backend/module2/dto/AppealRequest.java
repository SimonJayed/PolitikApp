package com.politikapp.backend.module2.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AppealRequest(
        @NotNull UUID submissionId
) {
}
