package com.politikapp.backend.module3.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "peer_applications", schema = "public")
public class PeerApplication {
    @Id
    @Column(name = "application_id")
    private UUID applicationId;

    @Column(name = "contributor_id", nullable = false)
    private UUID contributorId;

    @Column(name = "organization_type", nullable = false, length = 100)
    private String organizationType;

    @Column(name = "institutional_email", nullable = false, length = 255)
    private String institutionalEmail;

    @Column(name = "verification_proof_url", nullable = false)
    private String verificationProofUrl;

    @Column(name = "justification_statement", nullable = false, columnDefinition = "TEXT")
    private String justificationStatement;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "PENDING";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getApplicationId() {
        return applicationId;
    }

    public void setApplicationId(UUID applicationId) {
        this.applicationId = applicationId;
    }

    public UUID getContributorId() {
        return contributorId;
    }

    public void setContributorId(UUID contributorId) {
        this.contributorId = contributorId;
    }

    public String getOrganizationType() {
        return organizationType;
    }

    public void setOrganizationType(String organizationType) {
        this.organizationType = organizationType;
    }

    public String getInstitutionalEmail() {
        return institutionalEmail;
    }

    public void setInstitutionalEmail(String institutionalEmail) {
        this.institutionalEmail = institutionalEmail;
    }

    public String getVerificationProofUrl() {
        return verificationProofUrl;
    }

    public void setVerificationProofUrl(String verificationProofUrl) {
        this.verificationProofUrl = verificationProofUrl;
    }

    public String getJustificationStatement() {
        return justificationStatement;
    }

    public void setJustificationStatement(String justificationStatement) {
        this.justificationStatement = justificationStatement;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
