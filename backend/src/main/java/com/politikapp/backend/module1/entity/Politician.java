package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "politicians")
@Getter
@Setter
@NoArgsConstructor
public class Politician {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "politician_id", nullable = false)
    private UUID politicianId;

    @Column(name = "wikidata_id", unique = true, length = 50)
    private String wikidataId;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "position", nullable = false, length = 100)
    private String position;

    @Column(name = "jurisdiction", nullable = false, length = 100)
    private String jurisdiction;

    @Column(name = "party_affiliation", length = 100)
    private String partyAffiliation;

    @Column(name = "term_start")
    private LocalDate termStart;

    @Column(name = "term_end")
    private LocalDate termEnd;

    @Column(name = "profile_image_url", columnDefinition = "TEXT")
    private String profileImageUrl;

    @Column(name = "biography", columnDefinition = "TEXT")
    private String biography;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "status", length = 50)
    private String status = "ACTIVE";

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
