package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.dto.ContributorReputationResponse;
import com.politikapp.backend.module3.entity.ContributorTrustProfile;
import com.politikapp.backend.module3.entity.ReputationSubmissionRecord;
import com.politikapp.backend.module3.port.TokenInvalidationPort;
import com.politikapp.backend.module3.repository.ContributorTrustProfileRepository;
import com.politikapp.backend.module3.repository.ReputationSubmissionRecordRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContributorReputationService {
    public static final String UNAVAILABLE_MESSAGE =
            "Reputation check unavailable. Existing account status was preserved.";
    public static final String TOKEN_UNAVAILABLE_MESSAGE =
            "Token invalidation service unavailable. Account lock state was saved.";
    public static final String EVALUATED_MESSAGE = "Reputation check completed.";
    public static final String LOCKED_MESSAGE = "Contributor account locked after reputation check.";

    private static final Logger log = LoggerFactory.getLogger(ContributorReputationService.class);
    private static final List<String> TERMINAL_STATUSES = List.of("PUBLISHED", "REJECTED");
    private static final double LOCK_THRESHOLD = 15.0;

    private final ContributorTrustProfileRepository contributorRepository;
    private final ReputationSubmissionRecordRepository submissionRepository;
    private final TokenInvalidationPort tokenInvalidationPort;

    public ContributorReputationService(
            ContributorTrustProfileRepository contributorRepository,
            ReputationSubmissionRecordRepository submissionRepository,
            TokenInvalidationPort tokenInvalidationPort
    ) {
        this.contributorRepository = contributorRepository;
        this.submissionRepository = submissionRepository;
        this.tokenInvalidationPort = tokenInvalidationPort;
    }

    @Transactional
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

            ContributorTrustProfile profile = contributor.get();
            if (rejectionMetric > LOCK_THRESHOLD) {
                profile.setAccountStatus("LOCKED");
                profile.setWritingTokenStatus("INVALIDATED");
                ContributorTrustProfile savedProfile = contributorRepository.save(profile);
                return invalidateTokens(contributorId, rejectionMetric, savedProfile);
            }

            return new ContributorReputationResponse(
                    contributorId,
                    rejectionMetric,
                    profile.getAccountStatus(),
                    profile.getWritingTokenStatus(),
                    false,
                    false,
                    EVALUATED_MESSAGE
            );
        } catch (Exception exception) {
            log.warn("Module 3 reputation check failed for contributor {}.", contributorId, exception);
            return unavailableResponse(contributorId);
        }
    }

    private ContributorReputationResponse invalidateTokens(
            UUID contributorId,
            double rejectionMetric,
            ContributorTrustProfile profile
    ) {
        try {
            tokenInvalidationPort.invalidateActiveUserJsonWebTokens(contributorId);
            return new ContributorReputationResponse(
                    contributorId,
                    rejectionMetric,
                    profile.getAccountStatus(),
                    profile.getWritingTokenStatus(),
                    false,
                    true,
                    LOCKED_MESSAGE
            );
        } catch (Exception exception) {
            log.warn("Module 3 token invalidation failed for contributor {}.", contributorId, exception);
            return new ContributorReputationResponse(
                    contributorId,
                    rejectionMetric,
                    profile.getAccountStatus(),
                    profile.getWritingTokenStatus(),
                    true,
                    true,
                    TOKEN_UNAVAILABLE_MESSAGE
            );
        }
    }

    private ContributorReputationResponse unavailableResponse(UUID contributorId) {
        return new ContributorReputationResponse(contributorId, 0.0, "ACTIVE", "ACTIVE", true, false, UNAVAILABLE_MESSAGE);
    }
}
