package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.TimelineEntryResponse;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import com.politikapp.backend.module1.service.TimelineMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/politicians")
@CrossOrigin(origins = "*")
public class TimelineController {
    private final TimelineEntryRepository timelineEntryRepository;
    private final TimelineMapper timelineMapper;

    public TimelineController(
            TimelineEntryRepository timelineEntryRepository,
            TimelineMapper timelineMapper
    ) {
        this.timelineEntryRepository = timelineEntryRepository;
        this.timelineMapper = timelineMapper;
    }

    @GetMapping("/{politicianId}/timeline")
    public ResponseEntity<List<TimelineEntryResponse>> getTimeline(@PathVariable UUID politicianId) {
        List<TimelineEntryResponse> timeline = timelineEntryRepository
                .findActiveEntries(politicianId, "PUBLISHED")
                .stream()
                .map(timelineMapper::toResponse)
                .toList();
        return ResponseEntity.ok(timeline);
    }
}
