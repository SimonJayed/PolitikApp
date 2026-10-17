package com.politikapp.backend.module1.dto;

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
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        String profileImageUrl,
        String biography,
        String status,

        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate termStart,

        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate termEnd
) {
}
