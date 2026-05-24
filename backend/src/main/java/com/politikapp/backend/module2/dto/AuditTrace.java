package com.politikapp.backend.module2.dto;

import java.util.UUID;

/**
 * Data Transfer Object record holding automated diagnostic scan metrics for real-time frontend terminal streaming.
 */
public record AuditTrace(
    UUID queueId,
    String reason,
    boolean escalated,
    String timestamp
) {}
