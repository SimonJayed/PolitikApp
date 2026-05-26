package com.politikapp.backend.module3.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "profile_edit_submissions")
public class ReputationSubmissionRecord {
    @Id
    @Column(name = "submission_id", nullable = false)
    private UUID submissionId;

    @Column(name = "contributor_id", nullable = false)
    private UUID contributorId;

    @Column(name = "status", length = 50)
    private String status;

    public UUID getSubmissionId() {
        return submissionId;
    }

    public UUID getContributorId() {
        return contributorId;
    }

    public String getStatus() {
        return status;
    }
}
