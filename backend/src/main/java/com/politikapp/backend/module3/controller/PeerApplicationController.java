package com.politikapp.backend.module3.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.module3.dto.PeerApplicationPayload;
import com.politikapp.backend.module3.dto.PeerApplicationResponse;
import com.politikapp.backend.module3.entity.PeerApplication;
import com.politikapp.backend.module3.service.PeerApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Deprecated(since = "2.0", forRemoval = true)
@RestController
@RequestMapping("/api/peer-applications")
public class PeerApplicationController {

    private final PeerApplicationService peerApplicationService;

    public PeerApplicationController(PeerApplicationService peerApplicationService) {
        this.peerApplicationService = peerApplicationService;
    }

    @PostMapping("/submit")
    public ResponseEntity<PeerApplicationResponse> submitApplication(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody PeerApplicationPayload payload
    ) {
        PeerApplication app = peerApplicationService.submitPeerApplication(
                principal.getUserId(),
                payload.organizationType(),
                payload.institutionalEmail(),
                payload.verificationProofUrl(),
                payload.justificationStatement()
        );
        return ResponseEntity.ok(toResponse(app));
    }

    @GetMapping("/my")
    public ResponseEntity<List<PeerApplicationResponse>> getMyApplications(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        List<PeerApplication> apps = peerApplicationService.getApplicationsByContributor(principal.getUserId());
        return ResponseEntity.ok(apps.stream().map(this::toResponse).toList());
    }

    @GetMapping("/admin/pending")
    public ResponseEntity<List<PeerApplicationResponse>> getPendingApplications() {
        List<PeerApplication> apps = peerApplicationService.getPendingApplications();
        return ResponseEntity.ok(apps.stream().map(this::toResponse).toList());
    }

    @PostMapping("/admin/{applicationId}/approve")
    public ResponseEntity<Void> approveApplication(
            @PathVariable UUID applicationId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        peerApplicationService.approvePeerApplication(applicationId, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/{applicationId}/reject")
    public ResponseEntity<Void> rejectApplication(
            @PathVariable UUID applicationId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        peerApplicationService.rejectPeerApplication(applicationId, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    private PeerApplicationResponse toResponse(PeerApplication app) {
        return new PeerApplicationResponse(
                app.getApplicationId(),
                app.getContributorId(),
                app.getOrganizationType(),
                app.getInstitutionalEmail(),
                app.getVerificationProofUrl(),
                app.getJustificationStatement(),
                app.getStatus(),
                app.getCreatedAt()
        );
    }
}
