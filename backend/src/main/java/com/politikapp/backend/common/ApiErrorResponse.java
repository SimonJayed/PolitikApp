package com.politikapp.backend.common;

import java.time.Instant;

public record ApiErrorResponse(
        int status,
        String message,
        Instant timestamp
) {
    public static ApiErrorResponse of(int status, String message) {
        return new ApiErrorResponse(status, message, Instant.now());
    }
}
