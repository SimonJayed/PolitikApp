package com.politikapp.backend.module3.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module3.entity.ContributorTrustProfile;
import com.politikapp.backend.module3.entity.ReputationSubmissionRecord;
import com.politikapp.backend.module3.repository.ContributorTrustProfileRepository;
import com.politikapp.backend.module3.repository.ReputationSubmissionRecordRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class PenaltyController {
    private final ContributorTrustProfileRepository contributorRepository;
    private final ReputationSubmissionRecordRepository submissionRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public PenaltyController(
            ContributorTrustProfileRepository contributorRepository,
            ReputationSubmissionRecordRepository submissionRepository
    ) {
        this.contributorRepository = contributorRepository;
        this.submissionRepository = submissionRepository;
    }

    @GetMapping("/penalties")
    public ResponseEntity<List<ContributorTrustProfile>> getPenalties(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        List<ContributorTrustProfile> lockedProfiles = contributorRepository.findAll().stream()
                .filter(profile -> "LOCKED".equalsIgnoreCase(profile.getAccountStatus()))
                .toList();
        return ResponseEntity.ok(lockedProfiles);
    }

    @GetMapping("/penalties/{contributorId}")
    public ResponseEntity<Map<String, Object>> getPenaltyDetails(
            @PathVariable UUID contributorId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        ContributorTrustProfile profile = contributorRepository.findById(contributorId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Contributor profile not found."));

        @SuppressWarnings("unchecked")
        List<Object[]> auditLogs = entityManager.createNativeQuery(
                "SELECT log_id, peer_id, queue_id, score_change, previous_score, new_score, reason, created_at " +
                "FROM public.reputation_audit_logs " +
                "WHERE peer_id = :contributorId " +
                "ORDER BY created_at DESC"
        )
        .setParameter("contributorId", contributorId)
        .getResultList();

        List<Map<String, Object>> formattedLogs = auditLogs.stream().map(row -> {
            Map<String, Object> map = new HashMap<>();
            map.put("logId", row[0]);
            map.put("peerId", row[1]);
            map.put("queueId", row[2]);
            map.put("scoreChange", row[3]);
            map.put("previousScore", row[4]);
            map.put("newScore", row[5]);
            map.put("reason", row[6]);
            map.put("createdAt", row[7]);
            return map;
        }).toList();

        Map<String, Object> response = new HashMap<>();
        response.put("profile", profile);
        response.put("reputationLogs", formattedLogs);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/contributors/{contributorId}/submission-stats")
    public ResponseEntity<Map<String, Object>> getSubmissionStats(
            @PathVariable UUID contributorId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        assertAdmin(principal);
        List<ReputationSubmissionRecord> submissions = submissionRepository.findByContributorIdAndStatusIn(
                contributorId,
                List.of("PUBLISHED", "REJECTED")
        );

        long totalCount = submissions.size();
        long rejectedCount = submissions.stream()
                .filter(sub -> "REJECTED".equalsIgnoreCase(sub.getStatus()))
                .count();
        double rejectionRate = totalCount > 0 ? ((double) rejectedCount / totalCount) * 100.0 : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("contributorId", contributorId);
        stats.put("totalSubmissionsCount", totalCount);
        stats.put("rejectedSubmissionsCount", rejectedCount);
        stats.put("rejectionRatePercentage", rejectionRate);

        return ResponseEntity.ok(stats);
    }

    private void assertAdmin(AuthPrincipal principal) {
        if (principal == null) {
            throw new HttpResponseException(401, "Unauthorized: Authentication required.");
        }
        if (!"ADMIN".equals(principal.getRole()) && !"ADMINISTRATOR".equals(principal.getRole())) {
            throw new HttpResponseException(403, "Forbidden: Only administrators are authorized to access penalty systems.");
        }
    }
}
