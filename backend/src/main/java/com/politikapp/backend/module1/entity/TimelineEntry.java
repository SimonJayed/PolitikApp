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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_details", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> actionDetails = Collections.emptyMap();

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
        entry.politicianId = submission.getPoliticianId();
        entry.categoryTag = submission.getCategoryTag();
        entry.actionIdentifier = submission.getActionIdentifier();
        entry.actionDetails = submission.getActionDetails() == null
                ? Collections.emptyMap()
                : submission.getActionDetails();
        entry.summary = submission.getImpactSummary();
        entry.sourceUrl = submission.getSourceUrl();
        entry.publicationStatus = "PUBLISHED";
        return entry;
    }

    public UUID getTimelineId() {
        return timelineId;
    }

    public UUID getPoliticianId() {
        return politicianId;
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

    public String getSummary() {
        return summary;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public String getPublicationStatus() {
        return publicationStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
