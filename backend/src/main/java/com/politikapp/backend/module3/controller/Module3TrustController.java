package com.politikapp.backend.module3.controller;

import com.politikapp.backend.module3.dto.ContributorReputationResponse;
import com.politikapp.backend.module3.dto.VoteWeightResponse;
import com.politikapp.backend.module3.service.ContributorReputationService;
import com.politikapp.backend.module3.service.PeerVoteWeightService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/module3")
@CrossOrigin(origins = "*")
public class Module3TrustController {
    private final ContributorReputationService contributorReputationService;
    private final PeerVoteWeightService peerVoteWeightService;

    public Module3TrustController(
            ContributorReputationService contributorReputationService,
            PeerVoteWeightService peerVoteWeightService
    ) {
        this.contributorReputationService = contributorReputationService;
        this.peerVoteWeightService = peerVoteWeightService;
    }

    @PostMapping("/contributors/{contributorId}/reputation/evaluate")
    public ResponseEntity<ContributorReputationResponse> evaluateContributorReputation(
            @PathVariable String contributorId
    ) {
        return ResponseEntity.ok(contributorReputationService.evaluateContributorReputation(parseUuid(contributorId)));
    }

    @GetMapping("/peers/{peerId}/vote-weight")
    public ResponseEntity<VoteWeightResponse> resolvePeerVoteWeight(@PathVariable String peerId) {
        return ResponseEntity.ok(peerVoteWeightService.resolveVoteWeight(parseUuid(peerId)));
    }

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            return null;
        }
    }
}
