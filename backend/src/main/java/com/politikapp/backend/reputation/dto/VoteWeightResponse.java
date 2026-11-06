package com.politikapp.backend.reputation.dto;

import java.util.UUID;

public record VoteWeightResponse(
        UUID peerId,
        int voteWeight,
        double historicalPrecision,
        boolean fallbackUsed,
        String message
) {
}
