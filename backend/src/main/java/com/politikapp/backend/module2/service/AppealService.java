package com.politikapp.backend.module2.service;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import com.politikapp.backend.module2.dto.AppealResponse;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AppealService {
    private static final BigDecimal APPEAL_MINIMUM_TRUST = BigDecimal.valueOf(150.00);
    private static final BigDecimal APPEAL_DEPOSIT = BigDecimal.valueOf(-10.00);

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
        AuthUser appealer = authUserRepository.findById(appealerId)
                .orElseThrow(() -> new HttpResponseException(404, "Appealer account not found."));
        BigDecimal currentTrust = trustOrDefault(appealer.getTrustScore());
        if (currentTrust.compareTo(APPEAL_MINIMUM_TRUST) < 0) {
            throw new HttpResponseException(403, "Appeal denied: trust score must be at least 150.00.");
        }

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

        BigDecimal newTrust = currentTrust.add(APPEAL_DEPOSIT).max(BigDecimal.ZERO);
        appealer.setTrustScore(newTrust);
        authUserRepository.save(appealer);
        submission.setStatus("APPEALED_PENDING");
        queue.setQueueStatus("APPEALED_PENDING");
        queue.setAppealerId(appealerId);
        submissionRepository.save(submission);
        moderationQueueRepository.save(queue);

        return new AppealResponse(
                "Appeal filed. The record has been routed to admin adjudication.",
                submissionId,
                queue.getQueueId(),
                "APPEALED_PENDING",
                newTrust
        );
    }

    private BigDecimal trustOrDefault(BigDecimal value) {
        return value != null ? value : BigDecimal.valueOf(100.00);
    }
}
