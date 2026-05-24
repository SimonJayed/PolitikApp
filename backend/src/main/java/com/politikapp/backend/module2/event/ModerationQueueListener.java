package com.politikapp.backend.module2.event;

import com.politikapp.backend.common.event.SubmissionCreatedEvent;
import com.politikapp.backend.module2.service.ModerationQueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ModerationQueueListener {

    private static final Logger log = LoggerFactory.getLogger(ModerationQueueListener.class);
    private final ModerationQueueService moderationQueueService;

    public ModerationQueueListener(ModerationQueueService moderationQueueService) {
        this.moderationQueueService = moderationQueueService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleSubmissionCreated(SubmissionCreatedEvent event) {
        log.info("Intercepted submission created event for submission ID: {}", event.submissionId());
        try {
            moderationQueueService.enqueueAnonymizedSubmission(event);
        } catch (Exception ex) {
            // CRITICAL DECOUPLING GUARD: Intercept and log failures defensively.
            // This prevents downstream serialization/persistence exceptions from cascading back to the contributor.
            log.error("SYSTEM FALLBACK INITIALIZED: Failed to queue moderation entry for submission {}. Error: {}", 
                event.submissionId(), ex.getMessage(), ex);
        }
    }
}
