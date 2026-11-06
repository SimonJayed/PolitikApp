package com.politikapp.backend.politician.dto;

import java.util.List;

public record AlignedComparisonRow(
        String categoryTag,
        List<TimelineEntryResponse> recordsA,
        List<TimelineEntryResponse> recordsB
) {
}
