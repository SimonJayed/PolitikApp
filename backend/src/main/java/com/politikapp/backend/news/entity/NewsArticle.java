package com.politikapp.backend.news.entity;

import com.politikapp.backend.auth.entity.AuthUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "news_articles")
@Getter
@Setter
@NoArgsConstructor
public class NewsArticle {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_id", nullable = false)
    private GovernmentSource source;

    @Column(name = "original_title", nullable = false, columnDefinition = "TEXT")
    private String originalTitle;

    @Column(name = "suggested_title", columnDefinition = "TEXT")
    private String suggestedTitle;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "canonical_url", nullable = false, columnDefinition = "TEXT")
    private String canonicalUrl;

    @Column(name = "original_content", columnDefinition = "TEXT")
    private String originalContent;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "ai_key_points", columnDefinition = "TEXT")
    private String aiKeyPoints;

    @Column(nullable = false, length = 80)
    private String category = "Government Announcements";

    @Column(name = "original_published_at")
    private Instant originalPublishedAt;

    @Column(name = "retrieved_at", nullable = false)
    private Instant retrievedAt = Instant.now();

    @Column(nullable = false, length = 40)
    private String status = "RETRIEVED";

    @Column(name = "ai_model", length = 120)
    private String aiModel;

    @Column(name = "ai_processing_status", length = 40)
    private String aiProcessingStatus;

    @Column(name = "ai_processed_at")
    private Instant aiProcessedAt;

    @Column(name = "ai_processing_ms")
    private Long aiProcessingMs;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private AuthUser reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
