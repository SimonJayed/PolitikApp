package com.politikapp.backend.module2.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module2.dto.EscalatedQueueCardResponse;
import com.politikapp.backend.module2.dto.VoteCalculationTrace;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import com.politikapp.backend.module2.service.ModerationQueueService;
import com.politikapp.backend.module2.service.VoteService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/escalations")
@CrossOrigin(origins = "*")
public class AdminEscalationController {
    private final ModerationQueueService moderationQueueService;
    private final VoteService voteService;
    private final ModerationQueueRepository moderationQueueRepository;

    public AdminEscalationController(
            ModerationQueueService moderationQueueService,
            VoteService voteService,
            ModerationQueueRepository moderationQueueRepository
    ) {
        this.moderationQueueService = moderationQueueService;
        this.voteService = voteService;
        this.moderationQueueRepository = moderationQueueRepository;
    }

    @GetMapping
    public ResponseEntity<List<EscalatedQueueCardResponse>> getEscalatedQueue(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        return ResponseEntity.ok(moderationQueueService.getEscalatedModerationQueue());
    }

    @GetMapping("/{escalationId}")
    public ResponseEntity<ModerationQueue> getEscalationDetails(
            @PathVariable UUID escalationId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        ModerationQueue entry = moderationQueueRepository.findById(escalationId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target escalation entry not found."));
        return ResponseEntity.ok(entry);
    }

    @PostMapping("/{escalationId}/approve")
    public ResponseEntity<VoteCalculationTrace> approveEscalation(
            @PathVariable UUID escalationId,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        String reason = payload != null ? payload.get("reason") : "Administrative Approval Override";
        VoteCalculationTrace trace = voteService.processAdminOverride(escalationId, "PUBLISHED", reason);
        return ResponseEntity.ok(trace);
    }

    @PostMapping("/{escalationId}/reject")
    public ResponseEntity<VoteCalculationTrace> rejectEscalation(
            @PathVariable UUID escalationId,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        String reason = payload != null ? payload.get("reason") : "Administrative Rejection Override";
        VoteCalculationTrace trace = voteService.processAdminOverride(escalationId, "REJECTED", reason);
        return ResponseEntity.ok(trace);
    }

    @PostMapping("/{escalationId}/return-to-queue")
    public ResponseEntity<Map<String, Object>> returnToQueue(
            @PathVariable UUID escalationId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        voteService.returnToQueue(escalationId);
        return ResponseEntity.ok(Map.of(
                "message", "Successfully returned escalation back to jury review queue.",
                "queueId", escalationId
        ));
    }

    private void assertAdmin(AuthPrincipal principal) {
        if (principal == null) {
            throw new HttpResponseException(401, "Unauthorized: Authentication required.");
        }
        if (!"ADMIN".equals(principal.getRole()) && !"ADMINISTRATOR".equals(principal.getRole())) {
            throw new HttpResponseException(403, "Forbidden: Only administrators are authorized to access escalations.");
        }
    }
}
