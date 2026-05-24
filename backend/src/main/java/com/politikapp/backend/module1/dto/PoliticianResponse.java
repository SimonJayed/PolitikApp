package com.politikapp.backend.module1.dto;

import java.time.LocalDate;
import java.util.UUID;

public record PoliticianResponse(
        UUID politicianId,
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        LocalDate termStart,
        LocalDate termEnd,
        String profileImageUrl,
        String biography,
        String status
) {
}
