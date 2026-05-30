package com.politikapp.backend.module3.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module3.entity.PeerApplication;
import com.politikapp.backend.module3.repository.PeerApplicationRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PeerApplicationService {
    private static final Logger log = LoggerFactory.getLogger(PeerApplicationService.class);

    private final PeerApplicationRepository peerApplicationRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public PeerApplicationService(PeerApplicationRepository peerApplicationRepository) {
        this.peerApplicationRepository = peerApplicationRepository;
    }

    @Transactional
    public PeerApplication submitPeerApplication(UUID contributorId, String orgType, String email, String proofUrl, String justification) {
        log.info("Submitting peer application for contributor: {}", contributorId);
        
        // Basic validations
        if (orgType == null || orgType.trim().isEmpty() ||
            email == null || email.trim().isEmpty() ||
            proofUrl == null || proofUrl.trim().isEmpty() ||
            justification == null || justification.trim().isEmpty()) {
            throw new HttpResponseException(422, "Unprocessable Entity: Missing required fields.");
        }

        String normalizedOrg = orgType.trim().toUpperCase();
        if (!List.of("FACULTY", "RESEARCHER", "CAMPUS_JOURNALIST", "CIVIC_VOLUNTEER").contains(normalizedOrg)) {
            throw new HttpResponseException(422, "Unprocessable Entity: Invalid organization type: " + orgType);
        }

        PeerApplication app = new PeerApplication();
        app.setApplicationId(UUID.randomUUID());
        app.setContributorId(contributorId);
        app.setOrganizationType(normalizedOrg);
        app.setInstitutionalEmail(email.trim());
        app.setVerificationProofUrl(proofUrl.trim());
        app.setJustificationStatement(justification.trim());
        app.setStatus("PENDING");
        app.setCreatedAt(Instant.now());

        return peerApplicationRepository.save(app);
    }

    @Transactional(readOnly = true)
    public List<PeerApplication> getPendingApplications() {
        return peerApplicationRepository.findByStatus("PENDING");
    }

    @Transactional(readOnly = true)
    public List<PeerApplication> getApplicationsByContributor(UUID contributorId) {
        return peerApplicationRepository.findByContributorId(contributorId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void approvePeerApplication(UUID applicationId, UUID adminId) {
        log.info("Admin {} approving peer application: {}", adminId, applicationId);
        PeerApplication app = peerApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Application not found."));

        if (!"PENDING".equals(app.getStatus())) {
            throw new HttpResponseException(422, "Unprocessable Entity: Application has already been processed.");
        }

        app.setStatus("APPROVED");
        peerApplicationRepository.save(app);

        UUID contributorId = app.getContributorId();

        // Core Role Mutation: Elevate role to PEER, and bootstrap trust score to 150.00
        BigDecimal startingScore = BigDecimal.valueOf(150.00);
        BigDecimal previousScore = BigDecimal.valueOf(100.00);

        try {
            BigDecimal scoreData = (BigDecimal) entityManager.createNativeQuery(
                "SELECT trust_score FROM public.contributors WHERE contributor_id = :contributorId"
            ).setParameter("contributorId", contributorId).getSingleResult();

            if (scoreData != null) {
                previousScore = scoreData;
            }
        } catch (Exception e) {
            log.warn("Could not retrieve current trust score for contributor {}, defaulting to 100.0: {}", contributorId, e.getMessage());
        }

        entityManager.createNativeQuery(
            "UPDATE public.contributors SET role = 'PEER', trust_score = :startingScore WHERE contributor_id = :contributorId"
        )
        .setParameter("startingScore", startingScore)
        .setParameter("contributorId", contributorId)
        .executeUpdate();

        BigDecimal scoreChange = startingScore.subtract(previousScore);

        // Insert into Module 3 log system for auditing
        entityManager.createNativeQuery(
            "INSERT INTO public.reputation_audit_logs (log_id, peer_id, queue_id, score_change, previous_score, new_score, reason, created_at) " +
            "VALUES (:logId, :peerId, :queueId, :scoreChange, :prevScore, :newScore, :reason, CURRENT_TIMESTAMP)"
        )
        .setParameter("logId", UUID.randomUUID())
        .setParameter("peerId", contributorId)
        .setParameter("queueId", null) // Bootstrap is an admin action, no queue reference needed
        .setParameter("scoreChange", scoreChange)
        .setParameter("prevScore", previousScore)
        .setParameter("newScore", startingScore)
        .setParameter("reason", "Administrative Bootstrap: Initialized Founding Peer status via approved organizational verification.")
        .executeUpdate();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void rejectPeerApplication(UUID applicationId, UUID adminId) {
        log.info("Admin {} rejecting peer application: {}", adminId, applicationId);
        PeerApplication app = peerApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Application not found."));

        if (!"PENDING".equals(app.getStatus())) {
            throw new HttpResponseException(422, "Unprocessable Entity: Application has already been processed.");
        }

        app.setStatus("REJECTED");
        peerApplicationRepository.save(app);
    }
}
