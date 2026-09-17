package com.politikapp.backend.module3.controller;

import com.politikapp.backend.module3.dto.ContributorReputationResponse;
import com.politikapp.backend.module3.service.ContributorReputationService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/module3")
@CrossOrigin(origins = "*")
public class Module3TrustController {
    private final ContributorReputationService contributorReputationService;

    public Module3TrustController(ContributorReputationService contributorReputationService) {
        this.contributorReputationService = contributorReputationService;
    }

    @PostMapping("/contributors/{contributorId}/reputation/evaluate")
    public ResponseEntity<ContributorReputationResponse> evaluateContributorReputation(
            @PathVariable String contributorId
    ) {
        return ResponseEntity.ok(contributorReputationService.evaluateContributorReputation(parseUuid(contributorId)));
    }

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            return null;
        }
    }
}
