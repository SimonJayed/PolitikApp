package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.dto.ContributorReputationResponse;
import com.politikapp.backend.module3.entity.ContributorTrustProfile;
import com.politikapp.backend.module3.entity.ReputationSubmissionRecord;
import com.politikapp.backend.module3.repository.ContributorTrustProfileRepository;
import com.politikapp.backend.module3.repository.ReputationSubmissionRecordRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContributorReputationService {
        public static final String UNAVAILABLE_MESSAGE = "Reputation check unavailable.";
    public static final String EVALUATED_MESSAGE = "Reputation check completed.";

    private static final Logger log = LoggerFactory.getLogger(ContributorReputationService.class);
    private static final List<String> TERMINAL_STATUSES = List.of("PUBLISHED", "REJECTED");

    private final ContributorTrustProfileRepository contributorRepository;
    private final ReputationSubmissionRecordRepository submissionRepository;

    public ContributorReputationService(
            ContributorTrustProfileRepository contributorRepository,
            ReputationSubmissionRecordRepository submissionRepository
    ) {
        this.contributorRepository = contributorRepository;
        this.submissionRepository = submissionRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ContributorReputationResponse evaluateContributorReputation(UUID contributorId) {
        if (contributorId == null) {
            log.warn("Module 3 reputation check skipped because contributorId was missing.");
            return unavailableResponse(null);
        }

        try {
            Optional<ContributorTrustProfile> contributor = contributorRepository.findById(contributorId);
            if (contributor.isEmpty()) {
                log.warn("Module 3 reputation check skipped because contributor {} was not found.", contributorId);
                return unavailableResponse(contributorId);
            }

            List<ReputationSubmissionRecord> terminalSubmissions =
                    submissionRepository.findByContributorIdAndStatusIn(contributorId, TERMINAL_STATUSES);
            if (terminalSubmissions.isEmpty()) {
                log.warn("Module 3 reputation check skipped because contributor {} has no terminal history.", contributorId);
                return unavailableResponse(contributorId);
            }

            long rejectedCount = terminalSubmissions.stream()
                    .filter(submission -> "REJECTED".equals(submission.getStatus()))
                    .count();
            double rejectionMetric = ((double) rejectedCount / terminalSubmissions.size()) * 100;

            return new ContributorReputationResponse(
                    contributorId,
                    rejectionMetric,
                    "ACTIVE",
                    false,
                    false,
                    EVALUATED_MESSAGE
            );
        } catch (Exception exception) {
            log.warn("Module 3 reputation check failed for contributor {}.", contributorId, exception);
            return unavailableResponse(contributorId);
        }
    }

    private ContributorReputationResponse unavailableResponse(UUID contributorId) {
        return new ContributorReputationResponse(contributorId, 0.0, "ACTIVE", true, false, UNAVAILABLE_MESSAGE);
    }
}
