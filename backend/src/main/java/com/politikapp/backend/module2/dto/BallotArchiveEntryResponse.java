package com.politikapp.backend.module2.dto;

import java.time.Instant;
import java.util.UUID;

public record BallotArchiveEntryResponse(
    UUID queueId,
    String title,
    String userVote,
    String status,
    Instant votedAt,
    String sourceUrl
) {}
