package com.politikapp.backend.curation.service;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import com.politikapp.backend.curation.dto.AppealResponse;
import com.politikapp.backend.curation.entity.ModerationQueue;
import com.politikapp.backend.curation.repository.ModerationQueueRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AppealService {
    private final AuthUserRepository authUserRepository;
    private final ProfileEditSubmissionRepository submissionRepository;
    private final ModerationQueueRepository moderationQueueRepository;

    public AppealService(
            AuthUserRepository authUserRepository,
            ProfileEditSubmissionRepository submissionRepository,
            ModerationQueueRepository moderationQueueRepository
    ) {
        this.authUserRepository = authUserRepository;
        this.submissionRepository = submissionRepository;
        this.moderationQueueRepository = moderationQueueRepository;
    }

    @Transactional
    public AppealResponse fileAppeal(UUID submissionId, String details, UUID appealerId) {
        authUserRepository.findById(appealerId)
                .orElseThrow(() -> new HttpResponseException(404, "Appealer account not found."));

        ProfileEditSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new HttpResponseException(404, "Published submission not found."));
        if (!"PUBLISHED".equals(submission.getStatus())) {
            throw new HttpResponseException(422, "Only published records can be appealed.");
        }

        ModerationQueue queue = moderationQueueRepository.findBySubmissionId(submissionId)
                .orElseThrow(() -> new HttpResponseException(404, "Moderation queue entry not found for submission."));
        if ("APPEALED_PENDING".equals(queue.getQueueStatus())) {
            throw new HttpResponseException(409, "This record already has an appeal pending.");
        }

        submission.setStatus("APPEALED_PENDING");
        queue.setQueueStatus("APPEALED_PENDING");
        submissionRepository.save(submission);
        moderationQueueRepository.save(queue);

        return new AppealResponse(
                "Appeal filed. The record has been routed to admin adjudication.",
                submissionId,
                queue.getQueueId(),
                "APPEALED_PENDING",
                null
        );
    }
}
