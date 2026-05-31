package com.politikapp.backend.module2.service;

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

@Service
public class RevisionService {
    private static final Logger log = LoggerFactory.getLogger(RevisionService.class);
    private final ModerationQueueRepository moderationQueueRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public RevisionService(ModerationQueueRepository moderationQueueRepository) {
        this.moderationQueueRepository = moderationQueueRepository;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void flagEntryForRevision(ModerationQueue queue, ProfileEditSubmission submission) {
        log.info("Flagging entry {} for revision", queue.getQueueId());
        queue.setQueueStatus("REVISION_REQUIRED");
        submission.setStatus("REVISION_REQUIRED");
        moderationQueueRepository.save(queue);
        entityManager.merge(submission);
        
        routeToRewritePipeline(submission);
        notifyContributorForRevision(submission);
        maintainUnderReviewStatus(queue);
    }

    public void routeToRewritePipeline(ProfileEditSubmission submission) {
        log.info("Routing submission {} to contributor rewrite pipeline", submission.getSubmissionId());
    }

    public void notifyContributorForRevision(ProfileEditSubmission submission) {
        log.info("Notifying contributor {} that submission {} requires revision", 
                submission.getContributorId(), submission.getSubmissionId());
    }

    public void maintainUnderReviewStatus(ModerationQueue queue) {
        // Track intermediate status details inside the engine if necessary
    }
}
