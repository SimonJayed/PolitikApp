package com.politikapp.backend.module3.dto;

import java.time.Instant;
import java.util.UUID;

public record PeerApplicationResponse(
    UUID applicationId,
    UUID contributorId,
    String organizationType,
    String institutionalEmail,
    String verificationProofUrl,
    String justificationStatement,
    String status,
    Instant createdAt
) {}
