package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

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

    @Column(name = "primary_source_url", columnDefinition = "TEXT")
    private String primarySourceUrl;

    @Column(name = "verification_notes", columnDefinition = "TEXT")
    private String verificationNotes;

    @Column(name = "category_tag", nullable = false, length = 100)
    private String categoryTag;

    @Column(name = "action_identifier", nullable = false, length = 150)
    private String actionIdentifier;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "action_details")
    private Map<String, Object> actionDetails;

    @Column(name = "impact_summary", nullable = false, columnDefinition = "TEXT")
    private String impactSummary;

    @Column(name = "ai_generated")
    private boolean aiGenerated;

    @Column(name = "status", length = 50)
    private String status = "SUBMITTED_REQUEST";

    @Column(name = "challenge_target_id")
    private UUID challengeTargetId;

    @Column(name = "challenge_reason", columnDefinition = "TEXT")
    private String challengeReason;

    @Column(name = "evidence_url", columnDefinition = "TEXT")
    private String evidenceUrl;

    @Column(name = "admin_resolution_notes", columnDefinition = "TEXT")
    private String adminResolutionNotes;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public ProfileEditSubmission() {}

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
        submission.primarySourceUrl = sourceUrl;
        submission.categoryTag = categoryTag;
        submission.actionIdentifier = actionIdentifier;
        submission.actionDetails = actionDetails;
        submission.impactSummary = impactSummary;
        submission.status = "SUBMITTED_REQUEST";
        return submission;
    }

    public static ProfileEditSubmission citizenChallenge(
            UUID politicianId,
            UUID contributorId,
            UUID challengeTargetId,
            String challengeReason,
            String evidenceUrl
    ) {
        ProfileEditSubmission submission = new ProfileEditSubmission();
        submission.politicianId = politicianId;
        submission.contributorId = contributorId;
        submission.challengeTargetId = challengeTargetId;
        submission.challengeReason = challengeReason;
        submission.evidenceUrl = evidenceUrl;
        submission.sourceUrl = evidenceUrl != null ? evidenceUrl : "https://politikapp.civic/challenge";
        submission.primarySourceUrl = evidenceUrl;
        submission.categoryTag = "Challenge";
        submission.actionIdentifier = "CITIZEN_CHALLENGE";
        submission.impactSummary = challengeReason != null ? challengeReason : "Public Citizen Challenge submitted.";
        submission.status = "CHALLENGE_OPEN";
        return submission;
    }

    public static ProfileEditSubmission directPublished(
            UUID politicianId,
            UUID adminId,
            String primarySourceUrl,
            String categoryTag,
            String actionIdentifier,
            Map<String, Object> actionDetails,
            String impactSummary,
            String verificationNotes
    ) {
        ProfileEditSubmission submission = new ProfileEditSubmission();
        submission.politicianId = politicianId;
        submission.contributorId = adminId;
        submission.sourceUrl = primarySourceUrl;
        submission.primarySourceUrl = primarySourceUrl;
        submission.verificationNotes = verificationNotes;
        submission.categoryTag = categoryTag;
        submission.actionIdentifier = actionIdentifier;
        submission.actionDetails = actionDetails;
        submission.impactSummary = impactSummary;
        submission.status = "PUBLISHED";
        return submission;
    }

    public UUID getSubmissionId() {
        return submissionId;
    }

    public void setSubmissionId(UUID submissionId) {
        this.submissionId = submissionId;
    }

    public UUID getPoliticianId() {
        return politicianId;
    }

    public void setPoliticianId(UUID politicianId) {
        this.politicianId = politicianId;
    }

    public UUID getContributorId() {
        return contributorId;
    }

    public void setContributorId(UUID contributorId) {
        this.contributorId = contributorId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getPrimarySourceUrl() {
        return primarySourceUrl;
    }

    public void setPrimarySourceUrl(String primarySourceUrl) {
        this.primarySourceUrl = primarySourceUrl;
    }

    public String getVerificationNotes() {
        return verificationNotes;
    }

    public void setVerificationNotes(String verificationNotes) {
        this.verificationNotes = verificationNotes;
    }

    public String getCategoryTag() {
        return categoryTag;
    }

    public void setCategoryTag(String categoryTag) {
        this.categoryTag = categoryTag;
    }

    public String getActionIdentifier() {
        return actionIdentifier;
    }

    public void setActionIdentifier(String actionIdentifier) {
        this.actionIdentifier = actionIdentifier;
    }

    public Map<String, Object> getActionDetails() {
        return actionDetails;
    }

    public void setActionDetails(Map<String, Object> actionDetails) {
        this.actionDetails = actionDetails;
    }

    public String getImpactSummary() {
        return impactSummary;
    }

    public void setImpactSummary(String impactSummary) {
        this.impactSummary = impactSummary;
    }

    public boolean isAiGenerated() {
        return aiGenerated;
    }

    public void setAiGenerated(boolean aiGenerated) {
        this.aiGenerated = aiGenerated;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getChallengeTargetId() {
        return challengeTargetId;
    }

    public void setChallengeTargetId(UUID challengeTargetId) {
        this.challengeTargetId = challengeTargetId;
    }

    public String getChallengeReason() {
        return challengeReason;
    }

    public void setChallengeReason(String challengeReason) {
        this.challengeReason = challengeReason;
    }

    public String getEvidenceUrl() {
        return evidenceUrl;
    }

    public void setEvidenceUrl(String evidenceUrl) {
        this.evidenceUrl = evidenceUrl;
    }

    public String getAdminResolutionNotes() {
        return adminResolutionNotes;
    }

    public void setAdminResolutionNotes(String adminResolutionNotes) {
        this.adminResolutionNotes = adminResolutionNotes;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
