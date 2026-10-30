package com.politikapp.backend.politician.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;

/**
 * CreatePoliticianRequest
 * ─────────────────────────────────────────────────────────────────────────────
 * Request payload for POST /api/politicians (admin-only).
 *
 * @JsonFormat(pattern = "yyyy-MM-dd") is required on LocalDate fields to
 * instruct Jackson how to deserialize the ISO date strings sent by the
 * frontend form, preventing HttpMessageNotReadableException (400 Bad Request).
 */
public record CreatePoliticianRequest(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 150) String fullName,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100) String position,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100) String jurisdiction,
        @jakarta.validation.constraints.Size(max = 100) String partyAffiliation,
        @jakarta.validation.constraints.Size(max = 2048) String profileImageUrl,
        @jakarta.validation.constraints.Size(max = 10000) String biography,
        String status,

        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate termStart,

        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate termEnd
) {
}
