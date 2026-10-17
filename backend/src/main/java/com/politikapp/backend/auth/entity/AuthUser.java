package com.politikapp.backend.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "contributors")
public class AuthUser {
    @Id
    @Column(name = "contributor_id", nullable = false)
    private UUID userId;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "email", nullable = false, length = 150)
    private String email;

    @Column(name = "username", length = 80)
    private String username;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "role", nullable = false, length = 50)
    private String role;

    @Column(name = "account_status", nullable = false, length = 50)
    private String accountStatus = "ACTIVE";

    @Column(name = "writing_token_status", length = 50)
    private String writingTokenStatus = "ACTIVE";

    @Column(name = "trust_score", precision = 5, scale = 2)
    private BigDecimal trustScore = BigDecimal.valueOf(100.00);

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sandbox_profile_metrics")
    private Map<String, Object> sandboxProfileMetrics = new HashMap<>();

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
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

    public BigDecimal getTrustScore() {
        return trustScore;
    }

    public void setTrustScore(BigDecimal trustScore) {
        this.trustScore = trustScore;
    }

    public Map<String, Object> getSandboxProfileMetrics() {
        return sandboxProfileMetrics;
    }

    public void setSandboxProfileMetrics(Map<String, Object> sandboxProfileMetrics) {
        this.sandboxProfileMetrics = sandboxProfileMetrics;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
