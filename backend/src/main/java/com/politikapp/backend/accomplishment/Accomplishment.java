package com.politikapp.backend.accomplishment;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "politician_accomplishments")
@Getter
@Setter
@NoArgsConstructor
public class Accomplishment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "accomplishment_id", nullable = false)
    private UUID accomplishmentId;

    @Column(name = "politician_id", nullable = false)
    private UUID politicianId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "accomplishment_date")
    private LocalDate accomplishmentDate;

    @Column(name = "accomplishment_year")
    private Integer accomplishmentYear;

    @Column(length = 100)
    private String category;

    @Column(name = "source_url", nullable = false, length = 2048)
    private String sourceUrl;

    @Column(nullable = false)
    private boolean visible = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
