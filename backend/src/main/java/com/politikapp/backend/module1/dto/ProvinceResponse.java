package com.politikapp.backend.module1.dto;

import java.util.UUID;

public record ProvinceResponse(
        UUID provinceId,
        UUID regionId,
        String provinceName
) {
}
