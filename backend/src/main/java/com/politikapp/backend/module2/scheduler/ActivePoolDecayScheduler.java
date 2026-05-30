package com.politikapp.backend.module2.scheduler;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ActivePoolDecayScheduler {
    private static final Logger log = LoggerFactory.getLogger(ActivePoolDecayScheduler.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Scheduled(fixedDelayString = "${politikapp.scheduler.active-pool-decay-ms:900000}")
    @Transactional(readOnly = true)
    public void auditActiveVotingFootprint() {
        Object[] telemetry = (Object[]) entityManager.createNativeQuery(
                "SELECT COUNT(DISTINCT peer_id), COUNT(*), MAX(created_at) " +
                "FROM public.jury_votes " +
                "WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'"
        ).getSingleResult();

        long activePeers = telemetry[0] == null ? 0L : ((Number) telemetry[0]).longValue();
        long voteFootprints = telemetry[1] == null ? 0L : ((Number) telemetry[1]).longValue();
        Instant lastVoteAt = telemetry[2] instanceof Timestamp timestamp ? timestamp.toInstant() : null;
        String thresholdMode = activePeers < 3 ? "LOW_POOL_GRIDLOCK_GUARD" : "NORMAL_POOL";

        log.info(
                "Active pool telemetry: activePeers7d={}, voteFootprints7d={}, lastVoteAt={}, thresholdMode={}",
                activePeers,
                voteFootprints,
                lastVoteAt,
                thresholdMode
        );
    }
}
