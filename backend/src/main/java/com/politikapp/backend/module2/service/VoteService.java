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
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VoteService {
    private static final Logger log = LoggerFactory.getLogger(VoteService.class);

    private final ModerationQueueRepository moderationQueueRepository;
    private final JuryVoteRepository juryVoteRepository;
    private final ConsensusService consensusService;
    private final PublicationService publicationService;
    private final RevisionService revisionService;
    private final AdminReviewService adminReviewService;
    private final ApplicationEventPublisher eventPublisher;

    @PersistenceContext
    private EntityManager entityManager;

    public VoteService(
            ModerationQueueRepository moderationQueueRepository,
            JuryVoteRepository juryVoteRepository,
            ConsensusService consensusService,
            PublicationService publicationService,
            RevisionService revisionService,
            AdminReviewService adminReviewService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.moderationQueueRepository = moderationQueueRepository;
        this.juryVoteRepository = juryVoteRepository;
        this.consensusService = consensusService;
        this.publicationService = publicationService;
        this.revisionService = revisionService;
        this.adminReviewService = adminReviewService;
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
            revisionService.flagEntryForRevision(queue, submission);
            finalOutcomeStatus = "REVISION_REQUIRED";
            databaseActionTaken = "ROUTED_FOR_REVISION";
            thresholdMet = true;
            thresholdFormula = "Any FLAG vote routes submission to REVISION_REQUIRED";
        } else {
            String outcome = consensusService.determineModerationOutcome(agreeSum, disagreeSum, "PENDING");
            if ("PUBLISHED".equals(outcome)) {
                log.info("Consensus reached: APPROVED submission ID={}", submission.getSubmissionId());
                queue.setQueueStatus("PUBLISHED");
                submission.setStatus("PUBLISHED");
                publicationService.executePublicationTrigger(submission);
                
                finalOutcomeStatus = "PUBLISHED";
                databaseActionTaken = "CASCADED_TO_TIMELINE";
                thresholdMet = true;

                moderationQueueRepository.save(queue);
                entityManager.merge(submission);

                // Publish dynamic consensus event to decouple Module 3 reputation updates
                eventPublisher.publishEvent(new ConsensusReachedEvent(
                    queueId,
                    submission.getSubmissionId(),
                    submission.getContributorId(),
                    "PUBLISHED"
                ));
            } else if ("REJECTED".equals(outcome)) {
                log.info("Consensus reached: REJECTED submission ID={}", submission.getSubmissionId());
                queue.setQueueStatus("REJECTED");
                submission.setStatus("REJECTED");
                
                finalOutcomeStatus = "REJECTED";
                databaseActionTaken = "REJECTED_SUBMISSION";
                thresholdMet = true;

                moderationQueueRepository.save(queue);
                entityManager.merge(submission);

                // Publish dynamic consensus event to decouple Module 3 reputation updates
                eventPublisher.publishEvent(new ConsensusReachedEvent(
                    queueId,
                    submission.getSubmissionId(),
                    submission.getContributorId(),
                    "REJECTED"
                ));
            }
        }

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

    @Transactional
    public VoteCalculationTrace processAdminOverride(UUID queueId, String action, String reason) {
        return adminReviewService.processAdminOverride(queueId, action, reason);
    }

    @Transactional
    public void returnToQueue(UUID queueId) {
        adminReviewService.returnEntryToPeerQueue(queueId);
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
