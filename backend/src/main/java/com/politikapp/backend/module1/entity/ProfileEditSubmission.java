package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "profile_edit_submissions")
public class ProfileEditSubmission {
    @Id
    @Column(name = "submission_id", nullable = false)
    private UUID submissionId = UUID.randomUUID();

    @Column(name = "politician_id", nullable = false)
    private UUID politicianId;

    @Column(name = "contributor_id", nullable = false)
    private UUID contributorId;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "category_tag", nullable = false, length = 100)
    private String categoryTag;

    @Column(name = "action_identifier", nullable = false, length = 150)
    private String actionIdentifier;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_details", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> actionDetails = Collections.emptyMap();

    @Column(name = "impact_summary", nullable = false, columnDefinition = "TEXT")
    private String impactSummary;

    @Column(name = "ai_generated")
    private boolean aiGenerated;

    @Column(name = "status", length = 50)
    private String status = "SUBMITTED";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public static ProfileEditSubmission submitted(
            UUID politicianId,
            UUID contributorId,
            String sourceUrl,
            String categoryTag,
            String actionIdentifier,
            Map<String, Object> actionDetails,
            String impactSummary
    ) {
        ProfileEditSubmission submission = new ProfileEditSubmission();
        submission.politicianId = politicianId;
        submission.contributorId = contributorId;
        submission.sourceUrl = sourceUrl;
        submission.categoryTag = categoryTag;
        submission.actionIdentifier = actionIdentifier;
        submission.actionDetails = actionDetails == null ? Collections.emptyMap() : actionDetails;
        submission.impactSummary = impactSummary;
        return submission;
    }

    public UUID getSubmissionId() {
        return submissionId;
    }

    public UUID getPoliticianId() {
        return politicianId;
    }

    public UUID getContributorId() {
        return contributorId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public String getCategoryTag() {
        return categoryTag;
    }

    public String getActionIdentifier() {
        return actionIdentifier;
    }

    public Map<String, Object> getActionDetails() {
        return actionDetails;
    }

    public String getImpactSummary() {
        return impactSummary;
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
}
