package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.event.SubmissionCreatedEvent;
import com.politikapp.backend.module2.dto.PendingQueueCardResponse;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ModerationQueueService {
    private static final Logger log = LoggerFactory.getLogger(ModerationQueueService.class);

    private final ModerationQueueRepository moderationQueueRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public ModerationQueueService(ModerationQueueRepository moderationQueueRepository) {
        this.moderationQueueRepository = moderationQueueRepository;
    }

    /**
     * Enqueues a new submission into the moderation queue in response to the
     * SubmissionCreatedEvent, setting the starting status to JURY_REVIEW.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void enqueueAnonymizedSubmission(SubmissionCreatedEvent event) {
        log.info("Enqueuing new submission ID: {} to moderation queue", event.submissionId());
        
        ModerationQueue queueEntry = new ModerationQueue(
            event.submissionId(),
            event.politicianId()
        );
        queueEntry.setQueueId(event.submissionId());
        queueEntry.setQueueStatus("JURY_REVIEW");
        
        moderationQueueRepository.save(queueEntry);

        entityManager.createNativeQuery(
            "UPDATE public.profile_edit_submissions SET status = 'JURY_REVIEW', updated_at = CURRENT_TIMESTAMP WHERE submission_id = :submissionId"
        )
        .setParameter("submissionId", event.submissionId())
        .executeUpdate();
        
        log.info("Successfully enqueued submission. Assigned queue ID: {}", queueEntry.getQueueId());
    }

    /**
     * Fetches the queue deck views anonymizing authorship to maintain a double-blind peer-review.
     * Sets the contributor ID to null dynamically prior to payload transmission.
     */
    @Transactional(readOnly = true)
    public List<PendingQueueCardResponse> getAnonymizedModerationQueue() {
        log.info("Fetching anonymized moderation queue for JURY_REVIEW status");

        @SuppressWarnings("unchecked")
        List<Object[]> rawRows = entityManager.createNativeQuery(
            "SELECT mq.queue_id, mq.submission_id, mq.politician_id, pes.source_url, pes.category_tag, pes.action_identifier, " +
            "pes.impact_summary, mq.queue_status, mq.escalation_flag, mq.assigned_at, mq.created_at " +
            "FROM public.moderation_queue mq " +
            "JOIN public.profile_edit_submissions pes ON pes.submission_id = mq.submission_id " +
            "WHERE mq.queue_status IN ('PENDING', 'JURY_REVIEW') " +
            "ORDER BY mq.created_at ASC"
        ).getResultList();

        return rawRows.stream().map(row -> new PendingQueueCardResponse(
            (UUID) row[0],
            (UUID) row[1],
            (UUID) row[2],
            (String) row[3],
            (String) row[4],
            (String) row[5],
            (String) row[6],
            (String) row[7],
            (Boolean) row[8],
            row[9] != null ? ((java.sql.Timestamp) row[9]).toInstant() : null,
            row[10] != null ? ((java.sql.Timestamp) row[10]).toInstant() : null
        )).toList();
    }
}
