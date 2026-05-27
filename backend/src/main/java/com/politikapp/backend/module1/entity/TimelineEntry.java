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

    @Column(name = "category_tag", nullable = false, length = 100)
    private String categoryTag;

    @Column(name = "action_identifier", nullable = false, length = 150)
    private String actionIdentifier;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "action_details", columnDefinition = "jsonb")
    private Map<String, Object> actionDetails;

    @Column(name = "summary", nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "publication_status", length = 50)
    private String publicationStatus = "PUBLISHED";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public static TimelineEntry publishedFrom(ProfileEditSubmission submission) {
        TimelineEntry entry = new TimelineEntry();
        entry.setPoliticianId(submission.getPoliticianId());
        entry.setCategoryTag(submission.getCategoryTag());
        entry.setActionIdentifier(submission.getActionIdentifier());
        entry.setActionDetails(submission.getActionDetails());
        entry.setSummary(submission.getImpactSummary());
        entry.setSourceUrl(submission.getSourceUrl());
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

    public String getPublicationStatus() {
        return publicationStatus;
    }

    public void setPublicationStatus(String publicationStatus) {
        this.publicationStatus = publicationStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
