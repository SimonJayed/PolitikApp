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
@Table(name = "timeline_entries")
public class TimelineEntry {
    @Id
    @Column(name = "timeline_id", nullable = false)
    private UUID timelineId = UUID.randomUUID();

    @Column(name = "politician_id", nullable = false)
    private UUID politicianId;

    @Column(name = "submission_id")
    private UUID submissionId;

    @Column(name = "category_tag", nullable = false, length = 100)
    private String categoryTag;

    @Column(name = "action_identifier", nullable = false, length = 150)
    private String actionIdentifier;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "action_details")
    private Map<String, Object> actionDetails;

    @Column(name = "summary", nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "primary_source_url", columnDefinition = "TEXT")
    private String primarySourceUrl;

    @Column(name = "verification_notes", columnDefinition = "TEXT")
    private String verificationNotes;

    @Column(name = "publication_status", length = 50)
    private String publicationStatus = "PUBLISHED";

    @Column(name = "is_hidden", nullable = false)
    private boolean isHidden = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public TimelineEntry() {}

    public static TimelineEntry publishedFrom(ProfileEditSubmission submission) {
        TimelineEntry entry = new TimelineEntry();
        entry.setPoliticianId(submission.getPoliticianId());
        entry.setSubmissionId(submission.getSubmissionId());
        entry.setCategoryTag(submission.getCategoryTag());
        entry.setActionIdentifier(submission.getActionIdentifier());
        entry.setActionDetails(submission.getActionDetails());
        entry.setSummary(submission.getImpactSummary());
        entry.setSourceUrl(submission.getSourceUrl());
        entry.setPrimarySourceUrl(
                submission.getPrimarySourceUrl() != null ? submission.getPrimarySourceUrl() : submission.getSourceUrl()
        );
        entry.setVerificationNotes(submission.getVerificationNotes());
        entry.setPublicationStatus("PUBLISHED");
        return entry;
    }

    public UUID getTimelineId() {
        return timelineId;
    }

    public void setTimelineId(UUID timelineId) {
        this.timelineId = timelineId;
    }

    public UUID getPoliticianId() {
        return politicianId;
    }

    public void setPoliticianId(UUID politicianId) {
        this.politicianId = politicianId;
    }

    public UUID getSubmissionId() {
        return submissionId;
    }

    public void setSubmissionId(UUID submissionId) {
        this.submissionId = submissionId;
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

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
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

    public String getPublicationStatus() {
        return publicationStatus;
    }

    public void setPublicationStatus(String publicationStatus) {
        this.publicationStatus = publicationStatus;
    }

    public boolean getIsHidden() {
        return isHidden;
    }

    public void setIsHidden(boolean hidden) {
        isHidden = hidden;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
