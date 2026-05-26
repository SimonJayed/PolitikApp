package com.politikapp.backend.common.event;

import java.util.UUID;

/**
 * Shared immutable event payload to decouple Module 2 consensus achievements
 * from Module 3 reputation-based trust scoring updates and contributor penalties checks.
 */
public record ConsensusReachedEvent(
        UUID queueId,
        UUID submissionId,
        UUID contributorId,
        String finalOutcomeStatus
) {
}
