package com.politikapp.backend.module1.dto;

import java.time.LocalDate;
import java.util.UUID;

public record UpdatePoliticianRequest(
        String fullName,
        String position,
        String jurisdictionType,
        String positionCategory,
        String jurisdiction,
        UUID regionId,
        UUID provinceId,
        UUID cityMunicipalityId,
        String partyAffiliation,
        String profileImageUrl,
        String biography,
        String status,
        LocalDate termStart,
        LocalDate termEnd
) {
}
