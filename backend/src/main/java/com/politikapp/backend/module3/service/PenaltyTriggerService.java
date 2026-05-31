package com.politikapp.backend.module3.service;

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
public class PenaltyTriggerService {
    private static final Logger log = LoggerFactory.getLogger(PenaltyTriggerService.class);
    private static final int MIN_TERMINAL_SUBMISSIONS_FOR_LOCK = 5;

    private final ContributorTrustProfileRepository contributorRepository;
    private final ContributorStatisticsService statisticsService;
    private final RejectionMetricService metricService;
    private final AccountPenaltyService penaltyService;
    private final TokenInvalidationService tokenInvalidationService;

    public PenaltyTriggerService(
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

    @Transactional(propagation = Propagation.REQUIRED)
    public void detectCompletedModerationReview(UUID contributorId) {
        log.info("Triggering penalty evaluation sequence for contributor ID={}", contributorId);
        startPenaltyEvaluation(contributorId);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void startPenaltyEvaluation(UUID contributorId) {
        Optional<ContributorTrustProfile> contributor = contributorRepository.findById(contributorId);
        if (contributor.isEmpty()) {
            return;
        }

        List<ReputationSubmissionRecord> history = statisticsService.getSubmissionHistory(contributorId);
        long totalCount = statisticsService.getTotalSubmissionCount(history);
        long rejectedCount = statisticsService.getRejectedSubmissionCount(history);

        double rejectionMetric = metricService.computeRejectionMetric(rejectedCount, totalCount);

        if (totalCount >= MIN_TERMINAL_SUBMISSIONS_FOR_LOCK && metricService.evaluateRejectionThreshold(rejectionMetric)) {
            ContributorTrustProfile profile = contributor.get();
            penaltyService.lockContributorAccount(profile);
            tokenInvalidationService.invalidateWritingTokens(contributorId);
        }
    }

    public UUID identifyTargetContributor(UUID contributorId) {
        return contributorId;
    }
}
