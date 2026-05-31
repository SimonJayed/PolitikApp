package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.entity.ReputationSubmissionRecord;
import com.politikapp.backend.module3.repository.ReputationSubmissionRecordRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContributorStatisticsService {
    private final ReputationSubmissionRecordRepository submissionRepository;
    private static final List<String> TERMINAL_STATUSES = List.of("PUBLISHED", "REJECTED");

    public ContributorStatisticsService(ReputationSubmissionRecordRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    @Transactional(readOnly = true)
    public List<ReputationSubmissionRecord> getSubmissionHistory(UUID contributorId) {
        return submissionRepository.findByContributorIdAndStatusIn(contributorId, TERMINAL_STATUSES);
    }

    public long getRejectedSubmissionCount(List<ReputationSubmissionRecord> history) {
        return history.stream()
                .filter(sub -> "REJECTED".equalsIgnoreCase(sub.getStatus()))
                .count();
    }

    public long getTotalSubmissionCount(List<ReputationSubmissionRecord> history) {
        return history.size();
    }

    public boolean checkMissingSubmissionHistory(UUID contributorId) {
        return submissionRepository.findByContributorIdAndStatusIn(contributorId, TERMINAL_STATUSES).isEmpty();
    }
}
