package com.politikapp.backend.module1.dto;

import java.util.List;

public record AlignedComparisonRow(
        String categoryTag,
        List<TimelineEntryResponse> recordsA,
        List<TimelineEntryResponse> recordsB
) {
}
