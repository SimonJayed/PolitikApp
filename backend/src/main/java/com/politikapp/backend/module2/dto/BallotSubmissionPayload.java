package com.politikapp.backend.module2.dto;

import java.util.UUID;

/**
 * Data Transfer Object representing the peer ballot submission payload.
 */
public record BallotSubmissionPayload(
    UUID queueId,
    UUID peerId,
    String voteSelection,
    String voteReason
) {}
