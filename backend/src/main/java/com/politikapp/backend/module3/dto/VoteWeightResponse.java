package com.politikapp.backend.module3.dto;

import java.util.UUID;

public record VoteWeightResponse(
        UUID peerId,
        int voteWeight,
        double historicalPrecision,
        boolean fallbackUsed,
        String message
) {
}
