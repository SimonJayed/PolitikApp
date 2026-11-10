package com.politikapp.backend.politician.entity;

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

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "position", length = 100)
    private String position;

    @Column(name = "jurisdiction", length = 100)
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

    @Column(name = "status", length = 50)
    private String status = "ACTIVE";

    @Column(name = "profile_origin", nullable = false, length = 40)
    @org.hibernate.annotations.ColumnDefault("'ADMIN_CURATED'")
    private String profileOrigin = "ADMIN_CURATED";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
