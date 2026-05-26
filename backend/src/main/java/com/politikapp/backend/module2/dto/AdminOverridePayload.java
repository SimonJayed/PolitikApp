package com.politikapp.backend.module2.dto;

import java.util.UUID;

public record AdminOverridePayload(
    UUID queueId,
    String action,
    String reason
) {}
