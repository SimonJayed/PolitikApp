package com.politikapp.backend.module3.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "users")
public class ContributorTrustProfile {
    @Id
    @Column(name = "contributor_id", nullable = false)
    private UUID contributorId;

    public UUID getContributorId() {
        return contributorId;
    }
}
