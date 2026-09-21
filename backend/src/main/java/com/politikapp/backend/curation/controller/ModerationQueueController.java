package com.politikapp.backend.curation.controller;

import com.politikapp.backend.curation.dto.PendingQueueCardResponse;
import com.politikapp.backend.curation.service.ModerationQueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/moderation")
public class ModerationQueueController {
    private static final Logger log = LoggerFactory.getLogger(ModerationQueueController.class);

    private final ModerationQueueService moderationQueueService;

    public ModerationQueueController(ModerationQueueService moderationQueueService) {
        this.moderationQueueService = moderationQueueService;
    }

    @GetMapping("/pending")
    public ResponseEntity<List<PendingQueueCardResponse>> getAnonymizedQueue() {
        log.info("Received request for double-blind anonymized moderation queue");
        List<PendingQueueCardResponse> anonymizedQueue = moderationQueueService.getAnonymizedModerationQueue();
        return ResponseEntity.ok(anonymizedQueue);
    }
}
