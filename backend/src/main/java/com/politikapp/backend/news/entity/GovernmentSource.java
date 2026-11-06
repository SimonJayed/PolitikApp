package com.politikapp.backend.news.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "government_sources")
@Getter
@Setter
@NoArgsConstructor
public class GovernmentSource {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(name = "base_url", nullable = false, columnDefinition = "TEXT")
    private String baseUrl;

    @Column(name = "feed_url", columnDefinition = "TEXT")
    private String feedUrl;

    @Column(name = "retrieval_type", nullable = false, length = 40)
    private String retrievalType = "RSS";

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "last_fetched_at")
    private Instant lastFetchedAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
