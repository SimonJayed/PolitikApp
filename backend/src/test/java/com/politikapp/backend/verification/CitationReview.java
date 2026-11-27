package com.politikapp.backend.verification;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

// The integration tests use Hibernate to create their H2 schema.
@Entity
@Table(name = "citation_reviews")
@IdClass(CitationReview.Key.class)
class CitationReview {
    record Key(String recordType, UUID recordId) implements Serializable {}

    @Id @Column(name = "record_type", length = 24)
    private String recordType;
    @Id @Column(name = "record_id")
    private UUID recordId;
    @Column(name = "verification_status", nullable = false, length = 24)
    private String verificationStatus;
    @Column(name = "source_organization", length = 200)
    private String sourceOrganization;
    @Column(name = "source_url", length = 2048)
    private String sourceUrl;
    @Column(name = "verification_notes", length = 5000)
    private String verificationNotes;
    @Column(name = "attribution", length = 24)
    private String attribution;
    @Column(name = "record_updated_at", nullable = false)
    private Instant recordUpdatedAt;
    @Column(name = "reviewed_at", nullable = false)
    private Instant reviewedAt;
    @Column(name = "reviewed_by", nullable = false)
    private UUID reviewedBy;

    protected CitationReview() {}
}
