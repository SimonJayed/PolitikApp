package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
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

    @Column(name = "quantitative_metric", precision = 10, scale = 2)
    private BigDecimal quantitativeMetric = BigDecimal.ZERO;

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

    public BigDecimal getQuantitativeMetric() {
        return quantitativeMetric;
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
