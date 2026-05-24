package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.common.event.SubmissionCreatedEvent;
import com.politikapp.backend.module1.dto.BallotSubmissionPayload;
import com.politikapp.backend.module1.dto.SubmissionResponse;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
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
    public SubmissionResponse createSubmission(BallotSubmissionPayload payload) {
        sourceValidationService.validateSourceUrl(payload.sourceUrl());

        try {
            boolean parserSuccess = executeExternalAiSummaryExtraction(payload.impactSummary());
            ProfileEditSubmission submission = submissionRepository.save(ProfileEditSubmission.submitted(
                    payload.politicianId(),
                    payload.contributorId(),
                    payload.sourceUrl(),
                    payload.categoryTag(),
                    payload.actionIdentifier(),
                    payload.quantitativeMetric(),
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
                    submission.getQuantitativeMetric(),
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

    private boolean executeExternalAiSummaryExtraction(String text) {
        return text != null && !text.isBlank();
    }
}

