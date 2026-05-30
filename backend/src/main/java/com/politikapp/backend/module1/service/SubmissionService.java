package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.common.event.SubmissionCreatedEvent;
import com.politikapp.backend.module1.dto.BallotSubmissionPayload;
import com.politikapp.backend.module1.dto.SubmissionResponse;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@SuppressWarnings("null")
public class SubmissionService {
    private final SourceValidationService sourceValidationService;
    private final ProfileEditSubmissionRepository submissionRepository;
    private final SubmissionMapper submissionMapper;
    private final ApplicationEventPublisher eventPublisher;

    public SubmissionService(
            SourceValidationService sourceValidationService,
            ProfileEditSubmissionRepository submissionRepository,
            SubmissionMapper submissionMapper,
            ApplicationEventPublisher eventPublisher
    ) {
        this.sourceValidationService = sourceValidationService;
        this.submissionRepository = submissionRepository;
        this.submissionMapper = submissionMapper;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public SubmissionResponse createSubmission(BallotSubmissionPayload payload, UUID contributorId) {
        if (contributorId == null) {
            throw new HttpResponseException(401, "Authentication required.");
        }

        // Evaluate domain approval — non-blocking, result is stored as a flag
        boolean isApprovedDomain = sourceValidationService.checkApprovedDomain(payload.sourceUrl());

        // Enrich actionDetails with the domain approval flag for reviewer visibility
        java.util.Map<String, Object> enrichedDetails = new java.util.HashMap<>(
                payload.actionDetails() != null ? payload.actionDetails() : java.util.Map.of()
        );
        enrichedDetails.put("isApprovedDomain", isApprovedDomain);

        try {
            boolean parserSuccess = executeExternalAiSummaryExtraction(payload.impactSummary());
            ProfileEditSubmission submission = submissionRepository.save(ProfileEditSubmission.submitted(
                    payload.politicianId(),
                    contributorId,
                    payload.sourceUrl(),
                    payload.categoryTag(),
                    payload.actionIdentifier(),
                    enrichedDetails,
                    payload.impactSummary()
            ));

            // Publish event for decoupled Module 2 queuing
            eventPublisher.publishEvent(new SubmissionCreatedEvent(
                    submission.getSubmissionId(),
                    submission.getPoliticianId(),
                    submission.getContributorId(),
                    submission.getSourceUrl(),
                    submission.getCategoryTag(),
                    submission.getActionIdentifier(),
                    submission.getActionDetails(),
                    submission.getImpactSummary()
            ));

            String message = parserSuccess
                    ? "Transaction successfully committed to review queue ledger."
                    : "System fallback initialized. Saved entry to standard queue channels.";

            return submissionMapper.toResponse(submission, message);
        } catch (HttpResponseException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new HttpResponseException(503, "Service Unavailable: Asynchronous background dependency timeout.");
        }
    }

    @Transactional(readOnly = true)
    public SubmissionResponse getSubmissionById(java.util.UUID id) {
        ProfileEditSubmission submission = submissionRepository.findById(id)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Submission record does not exist."));
        return submissionMapper.toResponse(submission, "Submission record retrieved.");
    }

    @Transactional(readOnly = true)
    public java.util.List<SubmissionResponse> getSubmissionsByContributor(UUID contributorId) {
        return submissionRepository.findByContributorId(contributorId).stream()
                .map(s -> submissionMapper.toResponse(s, "Submission retrieved."))
                .toList();
    }

    private boolean executeExternalAiSummaryExtraction(String text) {
        return text != null && !text.isBlank();
    }
}
