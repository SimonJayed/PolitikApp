package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.entity.JuryVoteTrustRecord;
import com.politikapp.backend.module3.repository.JuryVoteTrustRecordRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReputationEngineService {
    private static final Logger log = LoggerFactory.getLogger(ReputationEngineService.class);

    private final JuryVoteTrustRecordRepository voteRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public ReputationEngineService(JuryVoteTrustRecordRepository voteRepository) {
        this.voteRepository = voteRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recalculateJuryReputations(UUID queueId, String finalOutcomeStatus) {
        log.info("Recalculating reviewer reputations for queueId={} outcome={}", queueId, finalOutcomeStatus);
        
        List<JuryVoteTrustRecord> votes = voteRepository.findByQueueId(queueId);
        if (votes.isEmpty()) {
            log.warn("No votes found for queueId={}, reputation score update bypassed.", queueId);
            return;
        }

        for (JuryVoteTrustRecord vote : votes) {
            UUID peerId = vote.getPeerId();
            String voteType = vote.getVoteType();

            // 1. Get current trust score from contributors table
            double previousScore = 100.0;
            try {
                BigDecimal scoreData = (BigDecimal) entityManager.createNativeQuery(
                    "SELECT trust_score FROM public.contributors WHERE contributor_id = :peerId"
                ).setParameter("peerId", peerId).getSingleResult();

                if (scoreData != null) {
                    previousScore = scoreData.doubleValue();
                }
            } catch (Exception e) {
                log.warn("Could not retrieve current trust score for peerId={}, defaulting to 100.0: {}", peerId, e.getMessage());
            }

            // 2. Determine score adjustment (+5.00 for aligned, -5.00 for opposed)
            boolean isAligned = ("AGREE".equals(voteType) && "PUBLISHED".equals(finalOutcomeStatus))
                    || ("DISAGREE".equals(voteType) && "REJECTED".equals(finalOutcomeStatus));

            double scoreChange = isAligned ? 5.00 : -5.00;
            double newScore = previousScore + scoreChange;
            if (newScore > 100.0) {
                newScore = 100.0;
            }
            if (newScore < 0.0) {
                newScore = 0.0;
            }

            String reason = isAligned
                ? "Reviewer ballot aligned with final community consensus on queue " + queueId
                : "Reviewer ballot opposed final community consensus on queue " + queueId;

            log.info("Updating reviewer trust score: peerId={}, change={}, prev={}, new={}", 
                peerId, scoreChange, previousScore, newScore);

            // 3. Update trust score in public.contributors
            try {
                entityManager.createNativeQuery(
                    "UPDATE public.contributors SET trust_score = :newScore WHERE contributor_id = :peerId"
                )
                .setParameter("newScore", BigDecimal.valueOf(newScore))
                .setParameter("peerId", peerId)
                .executeUpdate();
            } catch (Exception e) {
                log.error("Failed to update trust score in contributors table for peerId={}: {}", peerId, e.getMessage());
            }

            // 4. Log change in public.reputation_audit_logs
            try {
                entityManager.createNativeQuery(
                    "INSERT INTO public.reputation_audit_logs (log_id, peer_id, queue_id, score_change, previous_score, new_score, reason, created_at) " +
                    "VALUES (:logId, :peerId, :queueId, :scoreChange, :prevScore, :newScore, :reason, CURRENT_TIMESTAMP)"
                )
                .setParameter("logId", UUID.randomUUID())
                .setParameter("peerId", peerId)
                .setParameter("queueId", queueId)
                .setParameter("scoreChange", BigDecimal.valueOf(scoreChange))
                .setParameter("prevScore", BigDecimal.valueOf(previousScore))
                .setParameter("newScore", BigDecimal.valueOf(newScore))
                .setParameter("reason", reason)
                .executeUpdate();
            } catch (Exception e) {
                log.error("Failed to insert reputation log for peerId={} queueId={}: {}", peerId, queueId, e.getMessage());
            }
        }
    }
}
