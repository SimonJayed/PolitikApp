package com.politikapp.backend.module2.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "jury_votes")
public class JuryVote {
    @Id
    @Column(name = "vote_id", nullable = false)
    private UUID voteId = UUID.randomUUID();

    @Column(name = "queue_id", nullable = false)
    private UUID queueId;

    @Column(name = "peer_id", nullable = false)
    private UUID peerId;

    @Column(name = "vote_type", nullable = false, length = 50)
    private String voteType;

    @Column(name = "vote_weight", nullable = false)
    private int voteWeight = 1;

    @Column(name = "vote_reason", nullable = false, columnDefinition = "TEXT")
    private String voteReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public JuryVote() {}

    public JuryVote(UUID queueId, UUID peerId, String voteType, int voteWeight, String voteReason) {
        this.queueId = queueId;
        this.peerId = peerId;
        this.voteType = voteType;
        this.voteWeight = voteWeight;
        this.voteReason = voteReason;
    }

    public UUID getVoteId() {
        return voteId;
    }

    public void setVoteId(UUID voteId) {
        this.voteId = voteId;
    }

    public UUID getQueueId() {
        return queueId;
    }

    public void setQueueId(UUID queueId) {
        this.queueId = queueId;
    }

    public UUID getPeerId() {
        return peerId;
    }

    public void setPeerId(UUID peerId) {
        this.peerId = peerId;
    }

    public String getVoteType() {
        return voteType;
    }

    public void setVoteType(String voteType) {
        this.voteType = voteType;
    }

    public int getVoteWeight() {
        return voteWeight;
    }

    public void setVoteWeight(int voteWeight) {
        this.voteWeight = voteWeight;
    }

    public String getVoteReason() {
        return voteReason;
    }

    public void setVoteReason(String voteReason) {
        this.voteReason = voteReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
