package com.politikapp.backend.module2.dto;

import java.util.UUID;

/**
 * Data Transfer Object record returning full mathematical step-by-step trace metrics
 * of a cast vote and its direct consensus aggregate impacts.
 */
public record VoteCalculationTrace(
    UUID queueId,
    UUID peerId,
    String peerName,
    double peerTrustScore,
    int derivedWeight,
    String voteSelection,
    long totalAgreeWeight,
    long totalDisagreeWeight,
    String thresholdFormula,
    boolean thresholdMet,
    String finalOutcomeStatus,       // "PENDING", "PUBLISHED", "REJECTED"
    String databaseActionTaken,      // "NONE", "CASCADED_TO_TIMELINE", "REJECTED_SUBMISSION"
    String timestamp
) {}
