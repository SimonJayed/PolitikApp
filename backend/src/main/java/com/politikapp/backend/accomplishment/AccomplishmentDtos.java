package com.politikapp.backend.accomplishment;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class AccomplishmentDtos {
    private AccomplishmentDtos() {}

    public record UpsertRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 5000) String description,
            LocalDate accomplishmentDate,
            @Min(1) @Max(9999) Integer accomplishmentYear,
            @Size(max = 100) String category,
            @NotBlank @Size(max = 2048) String sourceUrl,
            @NotNull Boolean visible
    ) {}

    public record Response(UUID accomplishmentId, UUID politicianId, String title, String description,
            LocalDate accomplishmentDate, Integer accomplishmentYear, String category, String sourceUrl,
            boolean visible, Instant createdAt, Instant updatedAt) {
        static Response from(Accomplishment entry) {
            return new Response(entry.getAccomplishmentId(), entry.getPoliticianId(), entry.getTitle(),
                    entry.getDescription(), entry.getAccomplishmentDate(), entry.getAccomplishmentYear(),
                    entry.getCategory(), entry.getSourceUrl(), entry.isVisible(), entry.getCreatedAt(), entry.getUpdatedAt());
        }
    }
}
