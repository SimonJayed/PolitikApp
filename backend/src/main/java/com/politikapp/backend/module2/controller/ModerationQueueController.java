package com.politikapp.backend.module2.controller;

import com.politikapp.backend.module2.dto.BallotSubmissionPayload;
import com.politikapp.backend.module2.dto.PendingQueueCardResponse;
import com.politikapp.backend.module2.scheduler.EscalationSchedulerService;
import com.politikapp.backend.module2.service.ModerationQueueService;
import com.politikapp.backend.module2.service.VoteService;
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
    private final VoteService voteService;
    private final EscalationSchedulerService escalationSchedulerService;

    public ModerationQueueController(
            ModerationQueueService moderationQueueService,
            VoteService voteService,
            EscalationSchedulerService escalationSchedulerService
    ) {
        this.moderationQueueService = moderationQueueService;
        this.voteService = voteService;
        this.escalationSchedulerService = escalationSchedulerService;
    }

    @GetMapping("/pending")
    public ResponseEntity<List<PendingQueueCardResponse>> getAnonymizedQueue() {
        log.info("Received request for double-blind anonymized moderation queue");
        List<PendingQueueCardResponse> anonymizedQueue = moderationQueueService.getAnonymizedModerationQueue();
        return ResponseEntity.ok(anonymizedQueue);
    }

    @PostMapping("/vote")
    public ResponseEntity<com.politikapp.backend.module2.dto.VoteCalculationTrace> processVote(@RequestBody BallotSubmissionPayload payload) {
        log.info("Received peer review vote for queue ID: {}", payload.queueId());
        com.politikapp.backend.module2.dto.VoteCalculationTrace trace = voteService.processPeerBallot(
            payload.queueId(),
            payload.peerId(),
            payload.voteSelection(),
            payload.voteReason()
        );
        return ResponseEntity.ok(trace);
    }

    @PostMapping("/escalate/trigger")
    public ResponseEntity<Map<String, Object>> triggerEscalation() {
        log.info("Received manual request to trigger deadlock escalation audit");
        List<com.politikapp.backend.module2.dto.AuditTrace> traces = escalationSchedulerService.executeEscalationAudit();
        long escalatedCount = traces.stream().filter(com.politikapp.backend.module2.dto.AuditTrace::escalated).count();

        return ResponseEntity.ok(Map.of(
            "message", "Deadlock escalation audit completed successfully.",
            "escalatedCount", escalatedCount,
            "traces", traces
        ));
    }

}

