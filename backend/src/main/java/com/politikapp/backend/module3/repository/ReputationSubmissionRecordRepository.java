package com.politikapp.backend.module3.repository;

import com.politikapp.backend.module3.entity.ReputationSubmissionRecord;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReputationSubmissionRecordRepository extends JpaRepository<ReputationSubmissionRecord, UUID> {
    List<ReputationSubmissionRecord> findByContributorIdAndStatusIn(UUID contributorId, Collection<String> statuses);
}
