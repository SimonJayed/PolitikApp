package com.politikapp.backend.module3.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "moderation_queue")
public class ModerationOutcomeRecord {
    @Id
    @Column(name = "queue_id", nullable = false)
    private UUID queueId;

    @Column(name = "queue_status", length = 50)
    private String queueStatus;

    public UUID getQueueId() {
        return queueId;
    }

    public String getQueueStatus() {
        return queueStatus;
    }
}
