package com.politikapp.backend.politician.service;

import com.politikapp.backend.politician.dto.TimelineEntryResponse;
import com.politikapp.backend.politician.entity.TimelineEntry;
import org.springframework.stereotype.Component;

@Component
public class TimelineMapper {
    public TimelineEntryResponse toResponse(TimelineEntry entry) {
        return new TimelineEntryResponse(
                entry.getTimelineId(),
                entry.getPoliticianId(),
                entry.getSubmissionId(),
                entry.getCategoryTag(),
                entry.getActionIdentifier(),
                entry.getActionDetails(),
                entry.getSummary(),
                entry.getSourceUrl(),
                entry.getPublicationStatus(),
                entry.getIsHidden(),
                entry.getCreatedAt()
        );
    }
}
