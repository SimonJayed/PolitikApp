package com.politikapp.backend.module1.dto;

import java.util.UUID;

public record PoliticianFilterRequest(
        String query,
        String jurisdictionType,
        String positionCategory,
        String position,
        UUID regionId,
        UUID provinceId,
        UUID cityMunicipalityId,
        String partyAffiliation,
        String status
) {
}
