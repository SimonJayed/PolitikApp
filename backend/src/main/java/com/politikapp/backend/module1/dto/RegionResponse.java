package com.politikapp.backend.module1.dto;

import java.util.UUID;

public record RegionResponse(
        UUID regionId,
        String regionCode,
        String regionName
) {
}
