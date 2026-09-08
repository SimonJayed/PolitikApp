package com.politikapp.backend.module2.controller;

import com.politikapp.backend.module2.dto.PendingQueueCardResponse;
import com.politikapp.backend.module2.service.ModerationQueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/moderation")
@CrossOrigin(origins = "*")
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

    @PostMapping("/sandbox/shift-stage")
    public ResponseEntity<Map<String, Object>> sandboxShiftStage(
            @RequestBody Map<String, String> payload
    ) {
        log.info("Sandbox stage override shift requested");
        String queueId = payload.get("queueId");
        String direction = payload.get("direction");
        String newStatus = moderationQueueService.shiftSandboxStage(java.util.UUID.fromString(queueId), direction);
        return ResponseEntity.ok(Map.of(
            "message", "Sandbox stage successfully shifted.",
            "queueId", queueId,
            "newStatus", newStatus
        ));
    }
}
