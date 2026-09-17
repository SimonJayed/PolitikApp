package com.politikapp.backend.module3.event;

import com.politikapp.backend.common.event.ConsensusReachedEvent;
import com.politikapp.backend.module3.service.ContributorReputationService;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Decoupled event listener that processes Module 3 reputation updates
 * asynchronously
 * after successful Module 2 consensus transaction commits.
 */
@Component
public class ReputationEventListener {
    private static final Logger log = LoggerFactory.getLogger(ReputationEventListener.class);
    private static final BigDecimal STANDARD_PUBLISH_REWARD = BigDecimal.valueOf(15.00);
    private static final BigDecimal STANDARD_REJECTION_PENALTY = BigDecimal.valueOf(-20.00);

    private final ContributorReputationService contributorReputationService;

    public ReputationEventListener(ContributorReputationService contributorReputationService) {
        this.contributorReputationService = contributorReputationService;
    }

    /**
     * Captures ConsensusReachedEvent after-commit. Triggers reviewer trust scoring
     * updates
     * and evaluates contributor reputation safety metrics without blocking main
     * voting flows.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleConsensusReached(ConsensusReachedEvent event) {
        log.info("Received ConsensusReachedEvent (AFTER_COMMIT) - Queue ID: {}, Contributor ID: {}, Final Status: {}",
                event.queueId(), event.contributorId(), event.finalOutcomeStatus());

        try {
            // Legacy jury-vote reputation adjustments are retired. Contributor-level evaluation
            // remains the active reputation signal after moderation consensus.
            if (event.contributorId() != null) {
                contributorReputationService.evaluateContributorReputation(event.contributorId());
                log.info("Successfully evaluated reputation for contributor ID: {}", event.contributorId());
            } else {
                log.warn(
                        "Skipped contributor reputation evaluation because contributorId is null on event for queue ID: {}",
                        event.queueId());
            }
        } catch (Exception e) {
            log.error("Failed to evaluate reputation for contributor ID: {}: {}", event.contributorId(), e.getMessage(),
                    e);
        }
    }
}
