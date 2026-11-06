package com.politikapp.backend.reputation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "users")
public class ContributorTrustProfile {
    @Id
    @Column(name = "user_id", nullable = false)
    private UUID contributorId;

    @Column(name = "account_status", nullable = false, length = 50)
    private String accountStatus = "ACTIVE";

    public UUID getContributorId() {
        return contributorId;
    }

    public String getAccountStatus() {
        return accountStatus;
    }

    public void setAccountStatus(String accountStatus) {
        this.accountStatus = accountStatus;
    }
}
