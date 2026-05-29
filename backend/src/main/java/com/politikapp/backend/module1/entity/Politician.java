package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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

    @Column(name = "position", nullable = false, length = 100)
    private String position;

    @Column(name = "jurisdiction", nullable = false, length = 100)
    private String jurisdiction;

    @Column(name = "jurisdiction_type", length = 20)
    private String jurisdictionType;

    @Column(name = "position_category", length = 50)
    private String positionCategory;

    @ManyToOne
    @JoinColumn(name = "region_id")
    private Region region;

    @ManyToOne
    @JoinColumn(name = "province_id")
    private Province province;

    @ManyToOne
    @JoinColumn(name = "city_municipality_id")
    private CityMunicipality cityMunicipality;

    @Column(name = "party_affiliation", length = 100)
    private String partyAffiliation;

    @Column(name = "term_start", nullable = false)
    private LocalDate termStart;

    @Column(name = "term_end", nullable = false)
    private LocalDate termEnd;

    @Column(name = "profile_image_url", columnDefinition = "TEXT")
    private String profileImageUrl;

    @Column(name = "biography", columnDefinition = "TEXT")
    private String biography;

    @Column(name = "status", length = 50)
    private String status = "ACTIVE";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
