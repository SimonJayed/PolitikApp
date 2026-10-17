package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import com.politikapp.backend.module2.dto.AdminCurationDtos.*;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class CitizenChallengeService {
    private static final Logger log = LoggerFactory.getLogger(CitizenChallengeService.class);

    private final PoliticianRepository politicianRepository;
    private final TimelineEntryRepository timelineEntryRepository;
    private final ProfileEditSubmissionRepository submissionRepository;
    private final ModerationQueueRepository moderationQueueRepository;

    public CitizenChallengeService(
            PoliticianRepository politicianRepository,
            TimelineEntryRepository timelineEntryRepository,
            ProfileEditSubmissionRepository submissionRepository,
            ModerationQueueRepository moderationQueueRepository
    ) {
        this.politicianRepository = politicianRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.submissionRepository = submissionRepository;
        this.moderationQueueRepository = moderationQueueRepository;
    }

    /**
     * Citizens file a dispute/challenge against an existing published record.
     */
    @Transactional
    public ModerationQueue submitChallenge(PublicChallengeRequest request, UUID citizenId) {
        log.info("Citizen {} filing challenge against target record {}", citizenId, request.challengeTargetId());

        timelineEntryRepository.findById(request.challengeTargetId())
                .orElseThrow(() -> new HttpResponseException(404, "Target record to challenge not found: " + request.challengeTargetId()));

        politicianRepository.findById(request.politicianId())
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found: " + request.politicianId()));

        validateUrl(request.evidenceUrl(), "Evidence citation URL");

        ProfileEditSubmission submission = ProfileEditSubmission.citizenChallenge(
                request.politicianId(),
                citizenId,
                request.challengeTargetId(),
                request.challengeReason().trim(),
                request.evidenceUrl().trim()
        );
        submission = submissionRepository.save(submission);

        ModerationQueue queue = new ModerationQueue(submission.getSubmissionId(), request.politicianId());
        queue.setQueueStatus("CHALLENGE_OPEN");
        queue.setChallengeTargetId(request.challengeTargetId());
        queue.setChallengeReason(request.challengeReason().trim());
        queue.setEvidenceUrl(request.evidenceUrl().trim());
        return moderationQueueRepository.save(queue);
    }

    /**
     * Citizens propose a new metric (content request).
     */
    @Transactional
    public ModerationQueue submitContentRequest(CitizenContentRequest request, UUID citizenId) {
        log.info("Citizen {} proposing content request for politician {}", citizenId, request.politicianId());

        politicianRepository.findById(request.politicianId())
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found: " + request.politicianId()));

        validateUrl(request.primarySourceUrl(), "Primary source citation URL");

        ProfileEditSubmission submission = ProfileEditSubmission.submitted(
                request.politicianId(),
                citizenId,
                request.primarySourceUrl().trim(),
                request.categoryTag().trim(),
                request.actionIdentifier().trim(),
                request.actionDetails() != null ? request.actionDetails() : Collections.emptyMap(),
                request.impactSummary().trim()
        );
        submission.setStatus("SUBMITTED_REQUEST");
        submission = submissionRepository.save(submission);

        ModerationQueue queue = new ModerationQueue(submission.getSubmissionId(), request.politicianId());
        queue.setQueueStatus("SUBMITTED_REQUEST");
        return moderationQueueRepository.save(queue);
    }

    @Transactional(readOnly = true)
    public List<ModerationQueue> getChallengesForPolitician(UUID politicianId) {
        return moderationQueueRepository.findByPoliticianIdOrderByCreatedAtDesc(politicianId);
    }

    @Transactional(readOnly = true)
    public List<ModerationQueue> getChallengesForTarget(UUID challengeTargetId) {
        return moderationQueueRepository.findByChallengeTargetId(challengeTargetId);
    }

    private void validateUrl(String url, String fieldName) {
        if (url == null || url.isBlank()) {
            throw new HttpResponseException(422, fieldName + " cannot be blank.");
        }
        String trimmed = url.trim().toLowerCase();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            throw new HttpResponseException(422, fieldName + " must start with http:// or https://");
        }
    }
}
