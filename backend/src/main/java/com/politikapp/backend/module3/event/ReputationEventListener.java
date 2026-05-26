package com.politikapp.backend.module3.event;

import com.politikapp.backend.common.event.ConsensusReachedEvent;
import com.politikapp.backend.module3.service.ContributorReputationService;
import com.politikapp.backend.module3.service.ReputationEngineService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Decoupled event listener that processes Module 3 reputation updates asynchronously
 * after successful Module 2 consensus transaction commits.
 */
@Component
public class ReputationEventListener {
    private static final Logger log = LoggerFactory.getLogger(ReputationEventListener.class);

    private final ReputationEngineService reputationEngineService;
    private final ContributorReputationService contributorReputationService;

    public ReputationEventListener(
            ReputationEngineService reputationEngineService,
            ContributorReputationService contributorReputationService
    ) {
        this.reputationEngineService = reputationEngineService;
        this.contributorReputationService = contributorReputationService;
    }

    /**
     * Captures ConsensusReachedEvent after-commit. Triggers reviewer trust scoring updates
     * and evaluates contributor reputation safety metrics without blocking main voting flows.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleConsensusReached(ConsensusReachedEvent event) {
        log.info("Received ConsensusReachedEvent (AFTER_COMMIT) - Queue ID: {}, Contributor ID: {}, Final Status: {}",
                event.queueId(), event.contributorId(), event.finalOutcomeStatus());

        try {
            // Task 1: Recalculate peer reputations based on their jury votes
            reputationEngineService.recalculateJuryReputations(event.queueId(), event.finalOutcomeStatus());
            log.info("Successfully completed reputation adjustments for jury votes on queue ID: {}", event.queueId());
        } catch (Exception e) {
            log.error("Failed to recalculate jury reputations for queue ID: {}: {}", event.queueId(), e.getMessage(), e);
        }

        try {
            // Task 2: Evaluate the contributor's overall reputation and handle potential lockout
            if (event.contributorId() != null) {
                contributorReputationService.evaluateContributorReputation(event.contributorId());
                log.info("Successfully evaluated reputation for contributor ID: {}", event.contributorId());
            } else {
                log.warn("Skipped contributor reputation evaluation because contributorId is null on event for queue ID: {}", event.queueId());
            }
        } catch (Exception e) {
            log.error("Failed to evaluate reputation for contributor ID: {}: {}", event.contributorId(), e.getMessage(), e);
        }
    }
}
