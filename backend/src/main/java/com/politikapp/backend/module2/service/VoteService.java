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
import java.util.List;
import java.util.UUID;
import org.springframework.lang.NonNull;

@Service
public class VoteService {
    private static final Logger log = LoggerFactory.getLogger(VoteService.class);
    private static final BigDecimal APPEAL_WIN_REWARD = BigDecimal.valueOf(25.00);
    private static final BigDecimal APPEAL_LOSS_PENALTY = BigDecimal.valueOf(-20.00);
    private static final BigDecimal FAULTY_AGREE_JUROR_PENALTY = BigDecimal.valueOf(-10.00);
    private static final BigDecimal MAX_TRUST_SCORE = BigDecimal.valueOf(500.00);

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
     * @deprecated Deprecated in favor of the Centralized Admin-Curator and Public Challenge pipeline.
     */
    @Deprecated(since = "2.0", forRemoval = true)
    @Transactional
    public VoteCalculationTrace processPeerBallot(@NonNull UUID queueId, UUID peerId, String voteSelection, String voteReason) {
        log.warn("DEPRECATION NOTICE: processPeerBallot called for queueId={}. Peer voting consensus is deprecated in favor of Admin Adjudication.", queueId);
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

        // Fetch the corresponding ProfileEditSubmission to check self-voting
        ProfileEditSubmission submission = entityManager.find(ProfileEditSubmission.class, queueRow.getSubmissionId());
        if (submission == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal Server Error: Associated profile submission not found."
            );
        }
        if (peerId.equals(submission.getContributorId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN, 
                "Forbidden: Reviewers are restricted from casting ballots on their own submissions."
            );
        }

        // Check duplicate voting
        if (juryVoteRepository.existsByQueueIdAndPeerId(queueId, peerId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT, 
                "Conflict: Reviewer has already cast a ballot for this queue item."
            );
        }

        // 2. Fetch the peer's details dynamically from the contributors database table
        double trustScore = 100.0;
        String peerName = "Anonymous Peer";
        try {
            Object[] contributorData = (Object[]) entityManager.createNativeQuery(
                "SELECT trust_score, full_name, role FROM public.contributors WHERE contributor_id = :peerId"
            ).setParameter("peerId", peerId).getSingleResult();

            if (contributorData != null && contributorData.length > 0) {
                if (contributorData[0] != null) {
                    trustScore = ((BigDecimal) contributorData[0]).doubleValue();
                }
                if (contributorData.length > 1 && contributorData[1] != null) {
                    peerName = (String) contributorData[1];
                }
                String peerRole = "CONTRIBUTOR";
                if (contributorData.length > 2 && contributorData[2] != null) {
                    peerRole = (String) contributorData[2];
                }
                if (!"PEER".equals(peerRole) && !"ADMIN".equals(peerRole) && !"ADMINISTRATOR".equals(peerRole)) {
                    throw new HttpResponseException(403, "Forbidden: Only users with PEER or ADMIN roles are authorized to cast peer ballots.");
                }
            } else {
                throw new HttpResponseException(404, "Not Found: Contributor profile not found.");
            }
        } catch (HttpResponseException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Could not retrieve contributor details for peerId={}, error: {}", peerId, e.getMessage());
            throw new HttpResponseException(403, "Forbidden: Reviewer profile could not be validated.");
        }

        // 3. Scale vote weight dynamically based on historical consensus alignment precision
        int derivedWeight = deriveVoteWeight(peerId);

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
        boolean isAppealResolution = "APPEALED_PENDING".equals(queueRow.getQueueStatus());

        queueRow.setQueueStatus(normalizedAction);
        queueRow.setEscalationFlag(true); // Ensure flag remains marked for override tracing
        submission.setStatus(normalizedAction);

        if (isAppealResolution) {
            databaseActionTaken = resolveAppeal(queueRow, normalizedAction, submission.getSubmissionId());
        } else if ("PUBLISHED".equals(normalizedAction)) {
            cascadeToTimeline(submission);
        }

        moderationQueueRepository.save(queueRow);
        entityManager.merge(submission);

        if (!isAppealResolution) {
            // Publish dynamic consensus event to decouple Module 3 reputation updates.
            eventPublisher.publishEvent(new ConsensusReachedEvent(
                queueId,
                submission.getSubmissionId(),
                submission.getContributorId(),
                normalizedAction
            ));
        }

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

    private String resolveAppeal(ModerationQueue queue, String normalizedAction, UUID submissionId) {
        UUID appealerId = queue.getAppealerId();
        if (appealerId == null) {
            throw new HttpResponseException(500, "Appeal resolution failed: missing appealer mapping.");
        }

        if ("REJECTED".equals(normalizedAction)) {
            timelineEntryRepository.softDeleteBySubmissionId(submissionId);
            adjustTrustScore(
                    appealerId,
                    queue.getQueueId(),
                    APPEAL_WIN_REWARD,
                    "Appeal sustained: deposit refunded and civic accuracy bonus awarded for submission " + submissionId
            );

            List<UUID> faultyJurorIds = juryVoteRepository.findByQueueIdAndVoteType(queue.getQueueId(), "AGREE")
                    .stream()
                    .map(JuryVote::getPeerId)
                    .distinct()
                    .toList();
            for (UUID jurorId : faultyJurorIds) {
                adjustTrustScore(
                        jurorId,
                        queue.getQueueId(),
                        FAULTY_AGREE_JUROR_PENALTY,
                        "Appeal sustained: prior AGREE vote supported a record later rejected by admin"
                );
            }
            return "APPEAL_SUSTAINED_SOFT_DELETED";
        }

        adjustTrustScore(
                appealerId,
                queue.getQueueId(),
                APPEAL_LOSS_PENALTY,
                "Appeal denied: published record retained after admin adjudication for submission " + submissionId
        );
        return "APPEAL_DENIED_RECORD_RETAINED";
    }

    private void adjustTrustScore(UUID peerId, UUID queueId, BigDecimal scoreChange, String reason) {
        BigDecimal previousScore = fetchTrustScore(peerId);
        BigDecimal newScore = previousScore.add(scoreChange).max(BigDecimal.ZERO).min(MAX_TRUST_SCORE);

        entityManager.createNativeQuery(
                "UPDATE public.contributors SET trust_score = :newScore WHERE contributor_id = :peerId"
        )
        .setParameter("newScore", newScore)
        .setParameter("peerId", peerId)
        .executeUpdate();

        entityManager.createNativeQuery(
                "INSERT INTO public.reputation_audit_logs (log_id, peer_id, queue_id, score_change, previous_score, new_score, reason, created_at) " +
                "VALUES (:logId, :peerId, :queueId, :scoreChange, :previousScore, :newScore, :reason, CURRENT_TIMESTAMP)"
        )
        .setParameter("logId", UUID.randomUUID())
        .setParameter("peerId", peerId)
        .setParameter("queueId", queueId)
        .setParameter("scoreChange", scoreChange)
        .setParameter("previousScore", previousScore)
        .setParameter("newScore", newScore)
        .setParameter("reason", reason)
        .executeUpdate();
    }

    private BigDecimal fetchTrustScore(UUID peerId) {
        Object score = entityManager.createNativeQuery(
                "SELECT trust_score FROM public.contributors WHERE contributor_id = :peerId"
        )
        .setParameter("peerId", peerId)
        .getSingleResult();
        return score instanceof BigDecimal decimal ? decimal : BigDecimal.valueOf(100.00);
    }

    private int deriveVoteWeight(UUID peerId) {
        long totalValidationBallotsCast = 0;
        long totalConsensusAlignedVotes = 0;
        try {
            Object[] stats = (Object[]) entityManager.createNativeQuery(
                "SELECT count(*), " +
                "coalesce(sum(case when (j.vote_type = 'AGREE' and mq.queue_status = 'PUBLISHED') " +
                "or (j.vote_type = 'DISAGREE' and mq.queue_status = 'REJECTED') then 1 else 0 end), 0) " +
                "FROM public.jury_votes j " +
                "JOIN public.moderation_queue mq ON j.queue_id = mq.queue_id " +
                "WHERE j.peer_id = :peerId AND mq.queue_status IN ('PUBLISHED', 'REJECTED')"
            ).setParameter("peerId", peerId).getSingleResult();

            if (stats != null && stats.length > 0) {
                totalValidationBallotsCast = ((Number) stats[0]).longValue();
                totalConsensusAlignedVotes = ((Number) stats[1]).longValue();
            }
        } catch (Exception e) {
            log.warn("Could not calculate dynamic voting weight for peerId={}, default weight of 1 will be used: {}", peerId, e.getMessage());
        }

        if (totalValidationBallotsCast > 0) {
            double precisionRatingCoefficient = ((double) totalConsensusAlignedVotes / totalValidationBallotsCast) * 100.0;
            if (precisionRatingCoefficient >= 90.0) {
                return 5;
            }
        }
        return 1;
    }
}
