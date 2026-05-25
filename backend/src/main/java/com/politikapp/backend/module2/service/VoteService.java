package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.common.event.ConsensusReachedEvent;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module2.dto.VoteCalculationTrace;
import com.politikapp.backend.module2.entity.JuryVote;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.JuryVoteRepository;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.lang.NonNull;

@Service
public class VoteService {
    private static final Logger log = LoggerFactory.getLogger(VoteService.class);

    private final ModerationQueueRepository moderationQueueRepository;
    private final JuryVoteRepository juryVoteRepository;
    private final ApplicationEventPublisher eventPublisher;

    @PersistenceContext
    private EntityManager entityManager;

    public VoteService(
            ModerationQueueRepository moderationQueueRepository, 
            JuryVoteRepository juryVoteRepository,
            ApplicationEventPublisher eventPublisher) {
        this.moderationQueueRepository = moderationQueueRepository;
        this.juryVoteRepository = juryVoteRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Processes anonymous peer ballots. Scales reviewer weight based on database trust scores,
     * persists the JuryVote, runs the consensus algorithm, and returns the calculation trace.
     */
    @Transactional
    public VoteCalculationTrace processPeerBallot(@NonNull UUID queueId, UUID peerId, String voteSelection, String voteReason) {
        log.info("Processing peer ballot: peerId={}, queueId={}, vote={}", peerId, queueId, voteSelection);

        // 1. Verify queue entry exists and is in JURY_REVIEW status
        ModerationQueue queueRow = moderationQueueRepository.findById(queueId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target moderation queue entry not found."));

        if (!"JURY_REVIEW".equals(queueRow.getQueueStatus())) {
            throw new HttpResponseException(422, "Unprocessable Entity: Target record is not available for moderation.");
        }

        // 2. Fetch the peer's details dynamically from the contributors database table
        double trustScore = 100.0;
        String peerName = "Anonymous Peer";
        try {
            Object[] contributorData = (Object[]) entityManager.createNativeQuery(
                "SELECT trust_score, full_name FROM public.contributors WHERE contributor_id = :peerId"
            ).setParameter("peerId", peerId).getSingleResult();

            if (contributorData != null && contributorData.length > 0) {
                if (contributorData[0] != null) {
                    trustScore = ((BigDecimal) contributorData[0]).doubleValue();
                }
                if (contributorData.length > 1 && contributorData[1] != null) {
                    peerName = (String) contributorData[1];
                }
            }
        } catch (Exception e) {
            log.warn("Could not retrieve contributor details for peerId={}, using default values: {}", peerId, e.getMessage());
        }

        // 3. Scale vote weight based on trust score (accelerated weight threshold >= 90)
        int derivedWeight = (trustScore >= 90.0) ? 5 : 1;

        // 4. Save JuryVote ballot
        JuryVote vote = new JuryVote(
            queueId,
            peerId,
            voteSelection,
            derivedWeight,
            voteReason
        );
        juryVoteRepository.save(vote);
        log.info("Persisted jury vote. ID={}, derivedWeight={}", vote.getVoteId(), derivedWeight);

        // 5. Recalculate Consensus
        return calculateConsensusOutcome(queueRow, peerId, peerName, trustScore, derivedWeight, voteSelection);
    }

    private VoteCalculationTrace calculateConsensusOutcome(
            ModerationQueue queue, UUID peerId, String peerName, double peerTrust, int derivedWeight, String voteSelection) {
        UUID queueId = queue.getQueueId();

        // Fetch weighted vote sums from jury_votes
        long agreeSum = fetchWeightedVoteSum(queueId, "AGREE");
        long disagreeSum = fetchWeightedVoteSum(queueId, "DISAGREE");
        log.info("Consensus recalculation for queue={}: AGREE weighted sum={}, DISAGREE weighted sum={}", 
            queueId, agreeSum, disagreeSum);

        // Fetch the corresponding ProfileEditSubmission
        ProfileEditSubmission submission = entityManager.find(ProfileEditSubmission.class, queue.getSubmissionId());
        if (submission == null) {
            log.error("Corrupted state: profile submission {} associated with queue entry {} does not exist", 
                queue.getSubmissionId(), queueId);
            throw new HttpResponseException(500, "Internal Server Error: Associated profile submission not found.");
        }

        String finalOutcomeStatus = "PENDING";
        String databaseActionTaken = "NONE";
        boolean thresholdMet = false;
        String thresholdFormula = "AGREE >= 10 AND AGREE >= 2*DISAGREE (Publish) | DISAGREE >= 10 AND DISAGREE >= 2*AGREE (Reject)";

        if (agreeSum >= 10 && (agreeSum >= disagreeSum * 2)) {
            log.info("Consensus reached: APPROVED submission ID={}", submission.getSubmissionId());
            queue.setQueueStatus("PUBLISHED");
            setSubmissionStatus(submission, "PUBLISHED");
            cascadeToTimeline(submission);
            
            finalOutcomeStatus = "PUBLISHED";
            databaseActionTaken = "CASCADED_TO_TIMELINE";
            thresholdMet = true;

            // Publish dynamic consensus event to decouple Module 3 reputation updates
            eventPublisher.publishEvent(new ConsensusReachedEvent(
                queueId,
                submission.getSubmissionId(),
                submission.getContributorId(),
                "PUBLISHED"
            ));

        } else if (disagreeSum >= 10 && (disagreeSum >= agreeSum * 2)) {
            log.info("Consensus reached: REJECTED submission ID={}", submission.getSubmissionId());
            queue.setQueueStatus("REJECTED");
            setSubmissionStatus(submission, "REJECTED");
            
            finalOutcomeStatus = "REJECTED";
            databaseActionTaken = "REJECTED_SUBMISSION";
            thresholdMet = true;

            // Publish dynamic consensus event to decouple Module 3 reputation updates
            eventPublisher.publishEvent(new ConsensusReachedEvent(
                queueId,
                submission.getSubmissionId(),
                submission.getContributorId(),
                "REJECTED"
            ));
        }

        moderationQueueRepository.save(queue);
        entityManager.merge(submission);

        return new VoteCalculationTrace(
            queueId,
            peerId,
            peerName,
            peerTrust,
            derivedWeight,
            voteSelection,
            agreeSum,
            disagreeSum,
            thresholdFormula,
            thresholdMet,
            finalOutcomeStatus,
            databaseActionTaken,
            Instant.now().toString()
        );
    }

    private void setSubmissionStatus(ProfileEditSubmission submission, String status) {
        try {
            java.lang.reflect.Field field = ProfileEditSubmission.class.getDeclaredField("status");
            field.setAccessible(true);
            field.set(submission, status);
        } catch (Exception e) {
            log.error("Failed to update status on ProfileEditSubmission via reflection: {}", e.getMessage());
        }
    }

    private void cascadeToTimeline(ProfileEditSubmission submission) {
        log.info("Cascading approved edits to timeline_entries for politician ID={}", submission.getPoliticianId());
        try {
            entityManager.createNativeQuery(
                "INSERT INTO public.timeline_entries (timeline_id, politician_id, category_tag, action_identifier, quantitative_metric, summary, source_url, publication_status) " +
                "VALUES (:timelineId, :politicianId, :category, :action, :metric, :summary, :url, 'PUBLISHED')"
            )
            .setParameter("timelineId", UUID.randomUUID())
            .setParameter("politicianId", submission.getPoliticianId())
            .setParameter("category", submission.getCategoryTag())
            .setParameter("action", submission.getActionIdentifier())
            .setParameter("metric", submission.getQuantitativeMetric())
            .setParameter("summary", submission.getImpactSummary())
            .setParameter("url", submission.getSourceUrl())
            .executeUpdate();
            log.info("Successfully persisted timeline ledger record for politician ID={}", submission.getPoliticianId());
        } catch (Exception e) {
            log.error("Failed to cascade verified edits to timeline: {}", e.getMessage());
        }
    }

    private long fetchWeightedVoteSum(UUID queueId, String voteType) {
        Long sum = entityManager.createQuery(
            "SELECT SUM(j.voteWeight) FROM JuryVote j WHERE j.queueId = :queueId AND j.voteType = :voteType", Long.class
        )
        .setParameter("queueId", queueId)
        .setParameter("voteType", voteType)
        .getSingleResult();
        return sum != null ? sum : 0L;
    }
}
