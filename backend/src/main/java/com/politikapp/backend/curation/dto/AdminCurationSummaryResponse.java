package com.politikapp.backend.curation.dto;

public record AdminCurationSummaryResponse(
        long pendingAdjudications,
        long upheldRulings,
        long dismissedRulings,
        long totalCuratedRecords
) {}
