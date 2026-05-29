package com.politikapp.backend.module1.dto;

import java.util.UUID;

public record CityMunicipalityResponse(
        UUID cityMunicipalityId,
        UUID provinceId,
        String name,
        String type
) {
}
