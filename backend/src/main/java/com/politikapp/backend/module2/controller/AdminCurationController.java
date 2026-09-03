package com.politikapp.backend.module2.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.module1.entity.TimelineEntry;
import com.politikapp.backend.module2.dto.AdminCurationDtos.*;
import com.politikapp.backend.module2.service.AdminCurationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCurationController {
    private final AdminCurationService adminCurationService;

    public AdminCurationController(AdminCurationService adminCurationService) {
        this.adminCurationService = adminCurationService;
    }

    /**
     * Direct Admin CRUD: Add a verified curated metric (bills, projects, budgets, COA audits).
     */
    @PostMapping("/curation/metrics")
    public ResponseEntity<TimelineEntry> addCuratedMetric(
            @Valid @RequestBody AdminMetricUpsertRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        UUID adminId = principal != null ? principal.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000001");
        TimelineEntry entry = adminCurationService.addCuratedMetric(request, adminId);
        return ResponseEntity.ok(entry);
    }

    /**
     * Direct Admin CRUD: Update an existing published metric.
     */
    @PutMapping("/curation/metrics/{timelineId}")
    public ResponseEntity<TimelineEntry> updateCuratedMetric(
            @PathVariable UUID timelineId,
            @Valid @RequestBody AdminMetricUpsertRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        UUID adminId = principal != null ? principal.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000001");
        TimelineEntry entry = adminCurationService.updateCuratedMetric(timelineId, request, adminId);
        return ResponseEntity.ok(entry);
    }

    /**
     * Direct Admin CRUD: Hide / soft-delete a published metric.
     */
    @DeleteMapping("/curation/metrics/{timelineId}")
    public ResponseEntity<Void> deleteCuratedMetric(
            @PathVariable UUID timelineId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        UUID adminId = principal != null ? principal.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000001");
        adminCurationService.deleteCuratedMetric(timelineId, adminId, reason);
        return ResponseEntity.noContent().build();
    }

    /**
     * Fetch unified citizen request & dispute queue.
     */
    @GetMapping("/adjudication/queue")
    public ResponseEntity<List<AdjudicationQueueCardResponse>> getAdjudicationQueue(
            @RequestParam(required = false, defaultValue = "ALL") String status
    ) {
        return ResponseEntity.ok(adminCurationService.getAdjudicationQueue(status));
    }

    /**
     * Adjudicate a queue item (UNDER_REVIEW, RESOLVED_UPHELD, RESOLVED_DISMISSED).
     */
    @PostMapping("/adjudication/{queueId}/transition")
    public ResponseEntity<AdjudicationQueueCardResponse> transitionAdjudication(
            @PathVariable UUID queueId,
            @Valid @RequestBody AdjudicationTransitionRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        UUID adminId = principal != null ? principal.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000001");
        AdjudicationQueueCardResponse response = adminCurationService.adjudicateItem(queueId, request, adminId);
        return ResponseEntity.ok(response);
    }
}
