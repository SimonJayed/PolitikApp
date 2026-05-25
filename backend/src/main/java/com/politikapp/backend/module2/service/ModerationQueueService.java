package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.event.SubmissionCreatedEvent;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
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

        // Update the underlying ProfileEditSubmission status to JURY_REVIEW so it appears in the queue
        ProfileEditSubmission submission = entityManager.find(ProfileEditSubmission.class, event.submissionId());
        if (submission != null) {
            try {
                java.lang.reflect.Field field = ProfileEditSubmission.class.getDeclaredField("status");
                field.setAccessible(true);
                field.set(submission, "JURY_REVIEW");
                entityManager.merge(submission);
            } catch (Exception e) {
                log.error("Failed to update ProfileEditSubmission status to JURY_REVIEW: {}", e.getMessage());
            }
        }
        
        log.info("Successfully enqueued submission. Assigned queue ID: {}", queueEntry.getQueueId());
    }

    /**
     * Fetches the queue deck views anonymizing authorship to maintain a double-blind peer-review.
     * Sets the contributor ID to null dynamically prior to payload transmission.
     */
    @Transactional(readOnly = true)
    public List<ProfileEditSubmission> getAnonymizedModerationQueue() {
        log.info("Fetching anonymized moderation queue for JURY_REVIEW status");
        
        List<ProfileEditSubmission> rawQueue = entityManager.createQuery(
            "SELECT p FROM ProfileEditSubmission p WHERE p.status = 'JURY_REVIEW'", 
            ProfileEditSubmission.class
        ).getResultList();
        
        for (ProfileEditSubmission record : rawQueue) {
            // Identity Masking: Strip contributor ID completely before exposing to API
            try {
                java.lang.reflect.Field field = ProfileEditSubmission.class.getDeclaredField("contributorId");
                field.setAccessible(true);
                field.set(record, null);
            } catch (Exception e) {
                log.warn("Identity masking warning: failed to strip contributor ID via reflection: {}", e.getMessage());
            }
        }
        
        return rawQueue;
    }
}
