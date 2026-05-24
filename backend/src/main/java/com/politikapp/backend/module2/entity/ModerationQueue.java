package com.politikapp.backend.module2.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "moderation_queue")
public class ModerationQueue {
    @Id
    @Column(name = "queue_id", nullable = false)
    private UUID queueId = UUID.randomUUID();

    @Column(name = "submission_id", nullable = false)
    private UUID submissionId;

    @Column(name = "politician_id", nullable = false)
    private UUID politicianId;

    @Column(name = "queue_status", length = 50)
    private String queueStatus = "PENDING";

    @Column(name = "escalation_flag", nullable = false)
    private boolean escalationFlag = false;

    @Column(name = "assigned_at")
    @CreationTimestamp
    private Instant assignedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public ModerationQueue() {}

    public ModerationQueue(UUID submissionId, UUID politicianId) {
        this.submissionId = submissionId;
        this.politicianId = politicianId;
        this.queueStatus = "PENDING";
        this.escalationFlag = false;
    }

    public UUID getQueueId() {
        return queueId;
    }

    public void setQueueId(UUID queueId) {
        this.queueId = queueId;
    }

    public UUID getSubmissionId() {
        return submissionId;
    }

    public void setSubmissionId(UUID submissionId) {
        this.submissionId = submissionId;
    }

    public UUID getPoliticianId() {
        return politicianId;
    }

    public void setPoliticianId(UUID politicianId) {
        this.politicianId = politicianId;
    }

    public String getQueueStatus() {
        return queueStatus;
    }

    public void setQueueStatus(String queueStatus) {
        this.queueStatus = queueStatus;
    }

    public boolean isEscalationFlag() {
        return escalationFlag;
    }

    public void setEscalationFlag(boolean escalationFlag) {
        this.escalationFlag = escalationFlag;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public void setAssignedAt(Instant assignedAt) {
        this.assignedAt = assignedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
