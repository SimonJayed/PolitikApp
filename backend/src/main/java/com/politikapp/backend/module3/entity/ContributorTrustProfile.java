package com.politikapp.backend.module3.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "contributors")
public class ContributorTrustProfile {
    @Id
    @Column(name = "contributor_id", nullable = false)
    private UUID contributorId;

    @Column(name = "account_status", nullable = false, length = 50)
    private String accountStatus = "ACTIVE";

    @Column(name = "writing_token_status", length = 50)
    private String writingTokenStatus = "ACTIVE";

    public UUID getContributorId() {
        return contributorId;
    }

    public String getAccountStatus() {
        return accountStatus;
    }

    public void setAccountStatus(String accountStatus) {
        this.accountStatus = accountStatus;
    }

    public String getWritingTokenStatus() {
        return writingTokenStatus;
    }

    public void setWritingTokenStatus(String writingTokenStatus) {
        this.writingTokenStatus = writingTokenStatus;
    }
}
