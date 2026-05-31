package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.TimelineEntryResponse;
import com.politikapp.backend.module1.entity.TimelineEntry;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TimelineService {
    private final TimelineEntryRepository timelineEntryRepository;
    private final TimelineMapper timelineMapper;

    public TimelineService(
            TimelineEntryRepository timelineEntryRepository,
            TimelineMapper timelineMapper
    ) {
        this.timelineEntryRepository = timelineEntryRepository;
        this.timelineMapper = timelineMapper;
    }

    @Transactional(readOnly = true)
    public List<TimelineEntryResponse> getPublishedTimelineEntries(UUID politicianId) {
        List<TimelineEntry> entries = timelineEntryRepository.findActiveEntries(politicianId, "PUBLISHED");
        if (entries == null || entries.isEmpty()) {
            return handleEmptyTimeline();
        }
        return sortTimelineEntries(filterPublishedRecords(entries));
    }

    public List<TimelineEntry> filterPublishedRecords(List<TimelineEntry> entries) {
        return entries.stream()
                .filter(e -> "PUBLISHED".equals(e.getPublicationStatus()))
                .toList();
    }

    public List<TimelineEntryResponse> sortTimelineEntries(List<TimelineEntry> entries) {
        return entries.stream()
                .map(timelineMapper::toResponse)
                .toList();
    }

    public List<TimelineEntryResponse> handleEmptyTimeline() {
        return List.of();
    }
}
