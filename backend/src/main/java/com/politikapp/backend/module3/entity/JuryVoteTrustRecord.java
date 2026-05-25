package com.politikapp.backend.module3.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "jury_votes")
public class JuryVoteTrustRecord {
    @Id
    @Column(name = "vote_id", nullable = false)
    private UUID voteId;

    @Column(name = "queue_id", nullable = false)
    private UUID queueId;

    @Column(name = "peer_id", nullable = false)
    private UUID peerId;

    @Column(name = "vote_type", nullable = false, length = 50)
    private String voteType;

    @Column(name = "vote_weight", nullable = false)
    private int voteWeight = 1;

    public UUID getVoteId() {
        return voteId;
    }

    public UUID getQueueId() {
        return queueId;
    }

    public UUID getPeerId() {
        return peerId;
    }

    public String getVoteType() {
        return voteType;
    }

    public int getVoteWeight() {
        return voteWeight;
    }
}
