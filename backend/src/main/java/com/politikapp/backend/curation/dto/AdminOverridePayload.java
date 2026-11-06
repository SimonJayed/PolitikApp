package com.politikapp.backend.curation.dto;

import java.util.UUID;

public record AdminOverridePayload(
    UUID queueId,
    String action,
    String reason
) {}
