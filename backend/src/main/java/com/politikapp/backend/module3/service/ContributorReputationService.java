package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.dto.ContributorReputationResponse;
import com.politikapp.backend.module3.entity.ContributorTrustProfile;
import com.politikapp.backend.module3.entity.ReputationSubmissionRecord;
import com.politikapp.backend.module3.repository.ContributorTrustProfileRepository;
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
    public static final String UNAVAILABLE_MESSAGE =
            "Reputation check unavailable. Existing account status was preserved.";
    public static final String EVALUATED_MESSAGE = "Reputation check completed.";
    public static final String LOCKED_MESSAGE = "Contributor account locked after reputation check.";
    public static final String INSUFFICIENT_SAMPLE_MESSAGE =
            "Reputation check completed. Lockout threshold requires a larger terminal submission sample.";

    private static final Logger log = LoggerFactory.getLogger(ContributorReputationService.class);
    private static final int MIN_TERMINAL_SUBMISSIONS_FOR_LOCK = 5;

    private final ContributorTrustProfileRepository contributorRepository;
    private final ContributorStatisticsService statisticsService;
    private final RejectionMetricService metricService;
    private final AccountPenaltyService penaltyService;
    private final TokenInvalidationService tokenInvalidationService;

    public ContributorReputationService(
            ContributorTrustProfileRepository contributorRepository,
            ContributorStatisticsService statisticsService,
            RejectionMetricService metricService,
            AccountPenaltyService penaltyService,
            TokenInvalidationService tokenInvalidationService
    ) {
        this.contributorRepository = contributorRepository;
        this.statisticsService = statisticsService;
        this.metricService = metricService;
        this.penaltyService = penaltyService;
        this.tokenInvalidationService = tokenInvalidationService;
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

            List<ReputationSubmissionRecord> history = statisticsService.getSubmissionHistory(contributorId);
            if (history.isEmpty()) {
                log.warn("Module 3 reputation check skipped because contributor {} has no history.", contributorId);
                return unavailableResponse(contributorId);
            }

            long totalCount = statisticsService.getTotalSubmissionCount(history);
            long rejectedCount = statisticsService.getRejectedSubmissionCount(history);
            double rejectionMetric = metricService.computeRejectionMetric(rejectedCount, totalCount);

            ContributorTrustProfile profile = contributor.get();
            if (totalCount < MIN_TERMINAL_SUBMISSIONS_FOR_LOCK) {
                return new ContributorReputationResponse(
                        contributorId,
                        rejectionMetric,
                        profile.getAccountStatus(),
                        profile.getWritingTokenStatus(),
                        false,
                        false,
                        INSUFFICIENT_SAMPLE_MESSAGE
                );
            }

            if (metricService.evaluateRejectionThreshold(rejectionMetric)) {
                penaltyService.lockContributorAccount(profile);
                tokenInvalidationService.invalidateWritingTokens(contributorId);
                return new ContributorReputationResponse(
                        contributorId,
                        rejectionMetric,
                        "LOCKED",
                        "INVALIDATED",
                        false,
                        true,
                        LOCKED_MESSAGE
                );
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

    private ContributorReputationResponse unavailableResponse(UUID contributorId) {
        return new ContributorReputationResponse(contributorId, 0.0, "ACTIVE", "ACTIVE", true, false, UNAVAILABLE_MESSAGE);
    }
}
