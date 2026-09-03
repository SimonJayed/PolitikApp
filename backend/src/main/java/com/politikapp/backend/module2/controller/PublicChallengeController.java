package com.politikapp.backend.module2.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.module2.dto.AdminCurationDtos.*;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.service.CitizenChallengeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/challenges")
public class PublicChallengeController {
    private final CitizenChallengeService citizenChallengeService;

    public PublicChallengeController(CitizenChallengeService citizenChallengeService) {
        this.citizenChallengeService = citizenChallengeService;
    }

    /**
     * Citizens submit a public challenge/dispute against a published record.
     */
    @PostMapping
    public ResponseEntity<ModerationQueue> submitChallenge(
            @Valid @RequestBody PublicChallengeRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        UUID citizenId = principal != null ? principal.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000002");
        ModerationQueue queue = citizenChallengeService.submitChallenge(request, citizenId);
        return ResponseEntity.ok(queue);
    }

    /**
     * Citizens propose a metric (content request) with mandatory primary source citation.
     */
    @PostMapping("/propose")
    public ResponseEntity<ModerationQueue> proposeContent(
            @Valid @RequestBody CitizenContentRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        UUID citizenId = principal != null ? principal.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000002");
        ModerationQueue queue = citizenChallengeService.submitContentRequest(request, citizenId);
        return ResponseEntity.ok(queue);
    }

    /**
     * Get all challenges for a politician.
     */
    @GetMapping("/politician/{politicianId}")
    public ResponseEntity<List<ModerationQueue>> getChallengesForPolitician(@PathVariable UUID politicianId) {
        return ResponseEntity.ok(citizenChallengeService.getChallengesForPolitician(politicianId));
    }

    /**
     * Get challenges for a specific target timeline entry.
     */
    @GetMapping("/target/{targetId}")
    public ResponseEntity<List<ModerationQueue>> getChallengesForTarget(@PathVariable UUID targetId) {
        return ResponseEntity.ok(citizenChallengeService.getChallengesForTarget(targetId));
    }
}
