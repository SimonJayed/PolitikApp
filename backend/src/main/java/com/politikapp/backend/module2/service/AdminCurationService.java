package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.entity.TimelineEntry;
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

import java.time.Instant;
import java.util.*;

@Service
public class AdminCurationService {
    private static final Logger log = LoggerFactory.getLogger(AdminCurationService.class);

    private final PoliticianRepository politicianRepository;
    private final ProfileEditSubmissionRepository submissionRepository;
    private final TimelineEntryRepository timelineEntryRepository;
    private final ModerationQueueRepository moderationQueueRepository;

    public AdminCurationService(
            PoliticianRepository politicianRepository,
            ProfileEditSubmissionRepository submissionRepository,
            TimelineEntryRepository timelineEntryRepository,
            ModerationQueueRepository moderationQueueRepository
    ) {
        this.politicianRepository = politicianRepository;
        this.submissionRepository = submissionRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.moderationQueueRepository = moderationQueueRepository;
    }

    /**
     * Direct Admin CRUD: Add a verified curated metric (bills, projects, budgets, COA audits).
     * Mandatory primarySourceUrl is strictly verified before publishing.
     */
    @Transactional
    public TimelineEntry addCuratedMetric(AdminMetricUpsertRequest request, UUID adminId) {
        log.info("Admin {} adding curated metric for politician {}", adminId, request.politicianId());
        validateSourceUrl(request.primarySourceUrl());

        politicianRepository.findById(request.politicianId())
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found: " + request.politicianId()));

        ProfileEditSubmission submission = ProfileEditSubmission.directPublished(
                request.politicianId(),
                adminId,
                request.primarySourceUrl().trim(),
                request.categoryTag().trim(),
                request.actionIdentifier().trim(),
                request.actionDetails() != null ? request.actionDetails() : Collections.emptyMap(),
                request.impactSummary().trim(),
                request.verificationNotes()
        );
        submission = submissionRepository.save(submission);

        TimelineEntry timeline = TimelineEntry.publishedFrom(submission);
        return timelineEntryRepository.save(timeline);
    }

    /**
     * Direct Admin CRUD: Update an existing published metric.
     */
    @Transactional
    public TimelineEntry updateCuratedMetric(UUID timelineId, AdminMetricUpsertRequest request, UUID adminId) {
        log.info("Admin {} updating curated metric {}", adminId, timelineId);
        validateSourceUrl(request.primarySourceUrl());

        TimelineEntry timeline = timelineEntryRepository.findById(timelineId)
                .orElseThrow(() -> new HttpResponseException(404, "Timeline entry not found: " + timelineId));

        timeline.setCategoryTag(request.categoryTag().trim());
        timeline.setActionIdentifier(request.actionIdentifier().trim());
        timeline.setActionDetails(request.actionDetails() != null ? request.actionDetails() : Collections.emptyMap());
        timeline.setSummary(request.impactSummary().trim());
        timeline.setSourceUrl(request.primarySourceUrl().trim());
        timeline.setPrimarySourceUrl(request.primarySourceUrl().trim());
        timeline.setVerificationNotes(request.verificationNotes());

        if (timeline.getSubmissionId() != null) {
            submissionRepository.findById(timeline.getSubmissionId()).ifPresent(sub -> {
                sub.setCategoryTag(request.categoryTag().trim());
                sub.setActionIdentifier(request.actionIdentifier().trim());
                sub.setActionDetails(request.actionDetails() != null ? request.actionDetails() : Collections.emptyMap());
                sub.setImpactSummary(request.impactSummary().trim());
                sub.setSourceUrl(request.primarySourceUrl().trim());
                sub.setPrimarySourceUrl(request.primarySourceUrl().trim());
                sub.setVerificationNotes(request.verificationNotes());
                submissionRepository.save(sub);
            });
        }

        return timelineEntryRepository.save(timeline);
    }

    /**
     * Direct Admin CRUD: Soft-delete / hide a published metric.
     */
    @Transactional
    public void deleteCuratedMetric(UUID timelineId, UUID adminId, String reason) {
        log.info("Admin {} hiding curated metric {}", adminId, timelineId);
        TimelineEntry timeline = timelineEntryRepository.findById(timelineId)
                .orElseThrow(() -> new HttpResponseException(404, "Timeline entry not found: " + timelineId));

        timeline.setIsHidden(true);
        timeline.setPublicationStatus("RESOLVED_DISMISSED");
        timelineEntryRepository.save(timeline);

        if (timeline.getSubmissionId() != null) {
            submissionRepository.findById(timeline.getSubmissionId()).ifPresent(sub -> {
                sub.setStatus("RESOLVED_DISMISSED");
                sub.setAdminResolutionNotes(reason != null ? reason : "Removed by Admin Curator.");
                sub.setResolvedAt(Instant.now());
                submissionRepository.save(sub);
            });
        }
    }

    /**
     * Fetch unified adjudication queue entries.
     */
    @Transactional(readOnly = true)
    public List<AdjudicationQueueCardResponse> getAdjudicationQueue(String statusFilter) {
        List<ModerationQueue> queueItems;
        if (statusFilter != null && !statusFilter.isBlank() && !statusFilter.equalsIgnoreCase("ALL")) {
            queueItems = moderationQueueRepository.findByQueueStatusInOrderByCreatedAtDesc(List.of(statusFilter.trim().toUpperCase()));
        } else {
            queueItems = moderationQueueRepository.findAllByOrderByCreatedAtDesc();
        }

        List<AdjudicationQueueCardResponse> responses = new ArrayList<>();
        for (ModerationQueue q : queueItems) {
            Optional<ProfileEditSubmission> subOpt = submissionRepository.findById(q.getSubmissionId());
            Optional<Politician> polOpt = politicianRepository.findById(q.getPoliticianId());

            String polName = polOpt.map(Politician::getFullName).orElse("Unknown Politician");
            ProfileEditSubmission sub = subOpt.orElse(null);

            String itemType = (q.getChallengeTargetId() != null || "CHALLENGE_OPEN".equalsIgnoreCase(q.getQueueStatus()))
                    ? "PUBLIC_CHALLENGE" : "CONTENT_REQUEST";

            responses.add(new AdjudicationQueueCardResponse(
                    q.getQueueId(),
                    q.getSubmissionId(),
                    q.getPoliticianId(),
                    polName,
                    q.getQueueStatus(),
                    itemType,
                    sub != null ? sub.getCategoryTag() : "General",
                    sub != null ? sub.getActionIdentifier() : "UNKNOWN",
                    sub != null ? sub.getActionDetails() : Collections.emptyMap(),
                    sub != null ? sub.getImpactSummary() : "",
                    sub != null ? (sub.getPrimarySourceUrl() != null ? sub.getPrimarySourceUrl() : sub.getSourceUrl()) : "",
                    q.getChallengeTargetId(),
                    q.getChallengeReason(),
                    q.getEvidenceUrl(),
                    q.getAdminResolutionNotes(),
                    q.getResolvedAt(),
                    q.getCreatedAt()
            ));
        }
        return responses;
    }

    /**
     * Admin adjudication transition (UNDER_REVIEW, RESOLVED_UPHELD, RESOLVED_DISMISSED).
     */
    @Transactional
    public AdjudicationQueueCardResponse adjudicateItem(UUID queueId, AdjudicationTransitionRequest request, UUID adminId) {
        String targetStatus = request.targetStatus().trim().toUpperCase();
        if (!Set.of("UNDER_REVIEW", "RESOLVED_UPHELD", "RESOLVED_DISMISSED").contains(targetStatus)) {
            throw new HttpResponseException(422, "Invalid target status: " + targetStatus + ". Allowed: UNDER_REVIEW, RESOLVED_UPHELD, RESOLVED_DISMISSED.");
        }

        ModerationQueue queue = moderationQueueRepository.findById(queueId)
                .orElseThrow(() -> new HttpResponseException(404, "Adjudication queue item not found: " + queueId));

        ProfileEditSubmission submission = submissionRepository.findById(queue.getSubmissionId())
                .orElseThrow(() -> new HttpResponseException(404, "Submission record not found: " + queue.getSubmissionId()));

        queue.setQueueStatus(targetStatus);
        queue.setAdminResolutionNotes(request.adminResolutionNotes().trim());
        submission.setAdminResolutionNotes(request.adminResolutionNotes().trim());
        submission.setStatus(targetStatus);

        Instant now = Instant.now();

        if ("UNDER_REVIEW".equals(targetStatus)) {
            // Keep in review state
        } else if ("RESOLVED_UPHELD".equals(targetStatus)) {
            queue.setResolvedAt(now);
            submission.setResolvedAt(now);

            if (queue.getChallengeTargetId() != null) {
                // Citizen challenge upheld: the target record has proven inaccurate -> hide/archive target timeline entry
                timelineEntryRepository.findById(queue.getChallengeTargetId()).ifPresent(targetEntry -> {
                    targetEntry.setIsHidden(true);
                    targetEntry.setPublicationStatus("RESOLVED_DISMISSED");
                    targetEntry.setVerificationNotes("Hidden pursuant to upheld Public Challenge " + queue.getQueueId() + ": " + request.adminResolutionNotes());
                    timelineEntryRepository.save(targetEntry);
                });
            } else {
                // Citizen content request upheld: publish it into the live timeline ledger
                submission.setStatus("PUBLISHED");
                TimelineEntry timeline = TimelineEntry.publishedFrom(submission);
                timelineEntryRepository.save(timeline);
            }
        } else if ("RESOLVED_DISMISSED".equals(targetStatus)) {
            queue.setResolvedAt(now);
            submission.setResolvedAt(now);
            // Request or challenge was dismissed; no modification to target records
        }

        moderationQueueRepository.save(queue);
        submissionRepository.save(submission);

        Politician politician = politicianRepository.findById(queue.getPoliticianId()).orElse(null);

        String itemType = (queue.getChallengeTargetId() != null || "CHALLENGE_OPEN".equalsIgnoreCase(submission.getStatus()))
                ? "PUBLIC_CHALLENGE" : "CONTENT_REQUEST";

        return new AdjudicationQueueCardResponse(
                queue.getQueueId(),
                queue.getSubmissionId(),
                queue.getPoliticianId(),
                politician != null ? politician.getFullName() : "Unknown Politician",
                queue.getQueueStatus(),
                itemType,
                submission.getCategoryTag(),
                submission.getActionIdentifier(),
                submission.getActionDetails(),
                submission.getImpactSummary(),
                submission.getPrimarySourceUrl() != null ? submission.getPrimarySourceUrl() : submission.getSourceUrl(),
                queue.getChallengeTargetId(),
                queue.getChallengeReason(),
                queue.getEvidenceUrl(),
                queue.getAdminResolutionNotes(),
                queue.getResolvedAt(),
                queue.getCreatedAt()
        );
    }

    private void validateSourceUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new HttpResponseException(422, "Primary source citation URL cannot be blank.");
        }
        String trimmed = url.trim().toLowerCase();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            throw new HttpResponseException(422, "Primary source citation URL must begin with http:// or https://");
        }
    }
}
