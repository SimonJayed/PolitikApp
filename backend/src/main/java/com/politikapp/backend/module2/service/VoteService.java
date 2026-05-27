package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.common.event.ConsensusReachedEvent;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.entity.TimelineEntry;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
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
    private final TimelineEntryRepository timelineEntryRepository;
    private final ApplicationEventPublisher eventPublisher;

    @PersistenceContext
    private EntityManager entityManager;

    public VoteService(
            ModerationQueueRepository moderationQueueRepository, 
            JuryVoteRepository juryVoteRepository,
            TimelineEntryRepository timelineEntryRepository,
            ApplicationEventPublisher eventPublisher) {
        this.moderationQueueRepository = moderationQueueRepository;
        this.juryVoteRepository = juryVoteRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Processes anonymous peer ballots. Scales reviewer weight based on database trust scores,
     * persists the JuryVote, runs the consensus algorithm, and returns the calculation trace.
     */
    @Transactional
    public VoteCalculationTrace processPeerBallot(@NonNull UUID queueId, UUID peerId, String voteSelection, String voteReason) {
        log.info("Processing peer ballot: peerId={}, queueId={}, vote={}", peerId, queueId, voteSelection);
        String normalizedVote = voteSelection == null ? "" : voteSelection.trim().toUpperCase();
        if (!normalizedVote.equals("AGREE") && !normalizedVote.equals("DISAGREE") && !normalizedVote.equals("FLAG")) {
            throw new HttpResponseException(422, "Unprocessable Entity: voteSelection must be AGREE, DISAGREE, or FLAG.");
        }

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
            normalizedVote,
            derivedWeight,
            voteReason
        );
        juryVoteRepository.save(vote);
        log.info("Persisted jury vote. ID={}, derivedWeight={}", vote.getVoteId(), derivedWeight);

        // 5. Recalculate Consensus
        return calculateConsensusOutcome(queueRow, peerId, peerName, trustScore, derivedWeight, normalizedVote);
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

        if ("FLAG".equals(voteSelection)) {
            queue.setQueueStatus("REVISION_REQUIRED");
            submission.setStatus("REVISION_REQUIRED");
            finalOutcomeStatus = "REVISION_REQUIRED";
            databaseActionTaken = "ROUTED_FOR_REVISION";
            thresholdMet = true;
            thresholdFormula = "Any FLAG vote routes submission to REVISION_REQUIRED";
        } else if (agreeSum >= 10 && (agreeSum >= disagreeSum * 2)) {
            log.info("Consensus reached: APPROVED submission ID={}", submission.getSubmissionId());
            queue.setQueueStatus("PUBLISHED");
            submission.setStatus("PUBLISHED");
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
            submission.setStatus("REJECTED");
            
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

    private void cascadeToTimeline(ProfileEditSubmission submission) {
        log.info("Cascading approved edits to timeline_entries for politician ID={}", submission.getPoliticianId());
        try {
            timelineEntryRepository.save(TimelineEntry.publishedFrom(submission));
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

    /**
     * Processes administrative tie-breakers or overrides.
     * Bypasses standard community consensus, transitioning statuses directly.
     */
    @Transactional
    public VoteCalculationTrace processAdminOverride(UUID queueId, String action, String reason) {
        log.info("Processing administrative override: queueId={}, action={}, reason={}", queueId, action, reason);
        String normalizedAction = action == null ? "" : action.trim().toUpperCase();
        if (!normalizedAction.equals("PUBLISHED") && !normalizedAction.equals("REJECTED")) {
            throw new HttpResponseException(422, "Unprocessable Entity: action must be PUBLISHED or REJECTED.");
        }

        // 1. Verify queue entry exists
        ModerationQueue queueRow = moderationQueueRepository.findById(queueId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target moderation queue entry not found."));

        // 2. Fetch the corresponding ProfileEditSubmission
        ProfileEditSubmission submission = entityManager.find(ProfileEditSubmission.class, queueRow.getSubmissionId());
        if (submission == null) {
            log.error("Corrupted state: profile submission {} associated with queue entry {} does not exist", 
                queueRow.getSubmissionId(), queueId);
            throw new HttpResponseException(500, "Internal Server Error: Associated profile submission not found.");
        }

        String finalOutcomeStatus = normalizedAction;
        String databaseActionTaken = "ADMIN_OVERRIDE_" + normalizedAction;

        queueRow.setQueueStatus(normalizedAction);
        queueRow.setEscalationFlag(true); // Ensure flag remains marked for override tracing
        submission.setStatus(normalizedAction);

        if ("PUBLISHED".equals(normalizedAction)) {
            cascadeToTimeline(submission);
        }

        moderationQueueRepository.save(queueRow);
        entityManager.merge(submission);

        // Publish dynamic consensus event to decouple Module 3 reputation updates
        eventPublisher.publishEvent(new ConsensusReachedEvent(
            queueId,
            submission.getSubmissionId(),
            submission.getContributorId(),
            normalizedAction
        ));

        // Fetch current sums for tracing details
        long agreeSum = fetchWeightedVoteSum(queueId, "AGREE");
        long disagreeSum = fetchWeightedVoteSum(queueId, "DISAGREE");

        return new VoteCalculationTrace(
            queueId,
            UUID.fromString("00000000-0000-0000-0000-000000000000"), // System Admin ID
            "System Administrator",
            100.0,
            100, // Absolute admin override weight
            "OVERRIDE_" + normalizedAction,
            agreeSum,
            disagreeSum,
            "ADMINISTRATIVE_OVERRIDE_DECISION",
            true,
            finalOutcomeStatus,
            databaseActionTaken,
            Instant.now().toString()
        );
    }
}
