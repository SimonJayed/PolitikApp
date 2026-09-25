package com.politikapp.backend.common;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(
        int status,
        String message,
        Instant timestamp,
        Map<String, String> fieldErrors
) {
    public static ApiErrorResponse of(int status, String message) {
        return new ApiErrorResponse(status, message, Instant.now(), Map.of());
    }

    public static ApiErrorResponse withFieldErrors(int status, String message, Map<String, String> fieldErrors) {
        return new ApiErrorResponse(status, message, Instant.now(), fieldErrors);
    }
}
