package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.common.event.ConsensusReachedEvent;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import com.politikapp.backend.module2.dto.VoteCalculationTrace;
import com.politikapp.backend.module2.entity.JuryVote;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.JuryVoteRepository;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminReviewService {
    private static final Logger log = LoggerFactory.getLogger(AdminReviewService.class);
    private static final BigDecimal APPEAL_WIN_REWARD = BigDecimal.valueOf(25.00);
    private static final BigDecimal APPEAL_LOSS_PENALTY = BigDecimal.valueOf(-20.00);
    private static final BigDecimal FAULTY_AGREE_JUROR_PENALTY = BigDecimal.valueOf(-10.00);
    private static final BigDecimal MAX_TRUST_SCORE = BigDecimal.valueOf(500.00);

    private final ModerationQueueRepository moderationQueueRepository;
    private final JuryVoteRepository juryVoteRepository;
    private final TimelineEntryRepository timelineEntryRepository;
    private final PublicationService publicationService;
    private final ApplicationEventPublisher eventPublisher;

    @PersistenceContext
    private EntityManager entityManager;

    public AdminReviewService(
            ModerationQueueRepository moderationQueueRepository,
            JuryVoteRepository juryVoteRepository,
            TimelineEntryRepository timelineEntryRepository,
            PublicationService publicationService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.moderationQueueRepository = moderationQueueRepository;
        this.juryVoteRepository = juryVoteRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.publicationService = publicationService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public VoteCalculationTrace approveEntry(UUID queueId, String reason) {
        return processAdminOverride(queueId, "PUBLISHED", reason);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public VoteCalculationTrace rejectEntry(UUID queueId, String reason) {
        return processAdminOverride(queueId, "REJECTED", reason);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void returnEntryToPeerQueue(UUID queueId) {
        log.info("Returning queue entry {} to jury review status", queueId);
        ModerationQueue queueRow = moderationQueueRepository.findById(queueId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target moderation queue entry not found."));
        
        queueRow.setQueueStatus("JURY_REVIEW");
        moderationQueueRepository.save(queueRow);

        ProfileEditSubmission submission = entityManager.find(ProfileEditSubmission.class, queueRow.getSubmissionId());
        if (submission != null) {
            submission.setStatus("JURY_REVIEW");
            entityManager.merge(submission);
        }
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public VoteCalculationTrace processAdminOverride(UUID queueId, String action, String reason) {
        log.info("Processing administrative override: queueId={}, action={}, reason={}", queueId, action, reason);
        String normalizedAction = action == null ? "" : action.trim().toUpperCase();
        if (!normalizedAction.equals("PUBLISHED") && !normalizedAction.equals("REJECTED")) {
            throw new HttpResponseException(422, "Unprocessable Entity: action must be PUBLISHED or REJECTED.");
        }

        ModerationQueue queueRow = moderationQueueRepository.findById(queueId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target moderation queue entry not found."));

        ProfileEditSubmission submission = entityManager.find(ProfileEditSubmission.class, queueRow.getSubmissionId());
        if (submission == null) {
            throw new HttpResponseException(500, "Internal Server Error: Associated profile submission not found.");
        }

        String finalOutcomeStatus = normalizedAction;
        String databaseActionTaken = "ADMIN_OVERRIDE_" + normalizedAction;
        boolean isAppealResolution = "APPEALED_PENDING".equals(queueRow.getQueueStatus());

        queueRow.setQueueStatus(normalizedAction);
        queueRow.setEscalationFlag(true); 
        submission.setStatus(normalizedAction);

        if (isAppealResolution) {
            databaseActionTaken = resolveAppeal(queueRow, normalizedAction, submission.getSubmissionId());
        } else if ("PUBLISHED".equals(normalizedAction)) {
            publicationService.executePublicationTrigger(submission);
        }

        moderationQueueRepository.save(queueRow);
        entityManager.merge(submission);

        if (!isAppealResolution) {
            eventPublisher.publishEvent(new ConsensusReachedEvent(
                queueId,
                submission.getSubmissionId(),
                submission.getContributorId(),
                normalizedAction
            ));
        }

        long agreeSum = fetchWeightedVoteSum(queueId, "AGREE");
        long disagreeSum = fetchWeightedVoteSum(queueId, "DISAGREE");

        return new VoteCalculationTrace(
            queueId,
            UUID.fromString("00000000-0000-0000-0000-000000000000"), 
            "System Administrator",
            100.0,
            100, 
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

    @Transactional(propagation = Propagation.REQUIRED)
    public String resolveAppeal(ModerationQueue queue, String normalizedAction, UUID submissionId) {
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

    @Transactional(propagation = Propagation.REQUIRED)
    public void adjustTrustScore(UUID peerId, UUID queueId, BigDecimal scoreChange, String reason) {
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
