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
    public ResponseEntity<com.politikapp.backend.module2.dto.VoteCalculationTrace> processVote(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.politikapp.backend.auth.security.AuthPrincipal principal,
            @RequestBody BallotSubmissionPayload payload
    ) {
        log.info("Received peer review vote for queue ID: {}", payload.queueId());
        if (principal == null) {
            throw new com.politikapp.backend.common.HttpResponseException(401, "Unauthorized: Authentication required.");
        }
        com.politikapp.backend.module2.dto.VoteCalculationTrace trace = voteService.processPeerBallot(
            payload.queueId(),
            principal.getUserId(),
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

    @GetMapping("/escalated")
    public ResponseEntity<List<com.politikapp.backend.module2.dto.EscalatedQueueCardResponse>> getEscalatedQueue() {
        log.info("Received request for escalated moderation queue");
        List<com.politikapp.backend.module2.dto.EscalatedQueueCardResponse> escalatedQueue = moderationQueueService.getEscalatedModerationQueue();
        return ResponseEntity.ok(escalatedQueue);
    }

    @PostMapping("/override")
    public ResponseEntity<com.politikapp.backend.module2.dto.VoteCalculationTrace> processOverride(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.politikapp.backend.auth.security.AuthPrincipal principal,
            @RequestBody com.politikapp.backend.module2.dto.AdminOverridePayload payload
    ) {
        log.info("Received administrative override action for queue ID: {}", payload.queueId());
        if (principal == null) {
            throw new com.politikapp.backend.common.HttpResponseException(401, "Unauthorized: Authentication required.");
        }
        if (!"ADMIN".equals(principal.getRole()) && !"ADMINISTRATOR".equals(principal.getRole())) {
            throw new com.politikapp.backend.common.HttpResponseException(403, "Forbidden: Only administrators are authorized to execute administrative overrides.");
        }
        com.politikapp.backend.module2.dto.VoteCalculationTrace trace = voteService.processAdminOverride(
            payload.queueId(),
            payload.action(),
            payload.reason()
        );
        return ResponseEntity.ok(trace);
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
