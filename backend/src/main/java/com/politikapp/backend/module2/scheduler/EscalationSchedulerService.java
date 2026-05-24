package com.politikapp.backend.module2.scheduler;

import com.politikapp.backend.module2.dto.AuditTrace;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class EscalationSchedulerService {
    private static final Logger log = LoggerFactory.getLogger(EscalationSchedulerService.class);

    private final ModerationQueueRepository moderationQueueRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public EscalationSchedulerService(ModerationQueueRepository moderationQueueRepository) {
        this.moderationQueueRepository = moderationQueueRepository;
    }

    /**
     * Continuous background scheduler auditing the moderation queue every hour.
     * Triggers escalation if a card is stuck beyond 24 hours, or experiences a gridlock tie.
     */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void runHourlyEscalationAudit() {
        log.info("Starting background scheduler escalation audit...");
        executeEscalationAudit();
    }

    /**
     * Core escalation evaluation routine. Returns detailed diagnostics traces
     * to the frontend visual diagnostics terminal.
     */
    @Transactional
    public List<AuditTrace> executeEscalationAudit() {
        Instant now = Instant.now();
        long ageVelocityLimitMillis = 24L * 60 * 60 * 1000;
        List<AuditTrace> diagnosticTraces = new ArrayList<>();

        List<ModerationQueue> activeQueue = entityManager.createQuery(
            "SELECT m FROM ModerationQueue m WHERE m.queueStatus = 'PENDING' OR m.queueStatus = 'JURY_REVIEW'",
            ModerationQueue.class
        ).getResultList();

        log.info("Auditing {} active moderation queue entries for potential escalation", activeQueue.size());

        for (ModerationQueue entry : activeQueue) {
            boolean triggerVelocityEscalation = false;
            if (entry.getAssignedAt() != null) {
                long age = now.toEpochMilli() - entry.getAssignedAt().toEpochMilli();
                triggerVelocityEscalation = age >= ageVelocityLimitMillis;
            }

            long agreeSum = fetchWeightedVoteSum(entry.getQueueId(), "AGREE");
            long disagreeSum = fetchWeightedVoteSum(entry.getQueueId(), "DISAGREE");
            
            // Gridlock tie deadlock check (Agree > 0 and Agree == Disagree)
            boolean triggerGridlockEscalation = (agreeSum > 0 && agreeSum == disagreeSum);

            boolean escalated = false;
            String reason = "Pending consensus (" + agreeSum + " AGREE, " + disagreeSum + " DISAGREE).";

            if (triggerVelocityEscalation || triggerGridlockEscalation) {
                entry.setQueueStatus("ESCALATED");
                entry.setEscalationFlag(true);
                moderationQueueRepository.save(entry);
                escalated = true;
                
                if (triggerGridlockEscalation) {
                     reason = "Tie deadlock detected (" + agreeSum + " AGREE vs " + disagreeSum + " DISAGREE). Routed to Admin.";
                } else {
                     reason = "Temporal timeout exceeded (24+ hours stuck in queue). Routed to Admin.";
                }
            }

            diagnosticTraces.add(new AuditTrace(
                entry.getQueueId(),
                reason,
                escalated,
                Instant.now().toString()
            ));
        }

        log.info("Escalation audit finalized. Total tickets escalated: {}", 
            diagnosticTraces.stream().filter(AuditTrace::escalated).count());
        
        return diagnosticTraces;
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
