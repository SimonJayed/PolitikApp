package com.politikapp.backend.module3.controller;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module3.dto.VoteWeightResponse;
import com.politikapp.backend.module3.service.PeerVoteWeightService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class VotingWeightController {
    private final PeerVoteWeightService peerVoteWeightService;
    private final AuthUserRepository authUserRepository;

    public VotingWeightController(
            PeerVoteWeightService peerVoteWeightService,
            AuthUserRepository authUserRepository
    ) {
        this.peerVoteWeightService = peerVoteWeightService;
        this.authUserRepository = authUserRepository;
    }

    @GetMapping("/voting-weights")
    public ResponseEntity<List<AuthUser>> getVotingWeights(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        List<AuthUser> peerProfiles = authUserRepository.findAll().stream()
                .filter(profile -> "PEER".equalsIgnoreCase(profile.getRole()))
                .toList();
        return ResponseEntity.ok(peerProfiles);
    }

    @GetMapping("/voting-weights/{peerId}")
    public ResponseEntity<VoteWeightResponse> getVotingWeight(
            @PathVariable UUID peerId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        return ResponseEntity.ok(peerVoteWeightService.resolveVoteWeight(peerId));
    }

    @GetMapping("/peers/{peerId}/accuracy")
    public ResponseEntity<Map<String, Object>> getPeerAccuracy(
            @PathVariable UUID peerId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        VoteWeightResponse response = peerVoteWeightService.resolveVoteWeight(peerId);
        
        Map<String, Object> accuracyMap = new HashMap<>();
        accuracyMap.put("peerId", peerId);
        accuracyMap.put("voteWeight", response.voteWeight());
        accuracyMap.put("historicalAccuracyPercentage", response.historicalPrecision());
        accuracyMap.put("isDefaultApplied", response.fallbackUsed());
        accuracyMap.put("message", response.message());

        return ResponseEntity.ok(accuracyMap);
    }

    @PutMapping("/voting-weights/{peerId}/recalculate")
    public ResponseEntity<VoteWeightResponse> recalculateVotingWeight(
            @PathVariable UUID peerId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        VoteWeightResponse response = peerVoteWeightService.resolveVoteWeight(peerId);
        return ResponseEntity.ok(response);
    }

    private void assertAdmin(AuthPrincipal principal) {
        if (principal == null) {
            throw new HttpResponseException(401, "Unauthorized: Authentication required.");
        }
        if (!"ADMIN".equals(principal.getRole()) && !"ADMINISTRATOR".equals(principal.getRole())) {
            throw new HttpResponseException(403, "Forbidden: Only administrators are authorized to access peer voting weights.");
        }
    }
}
