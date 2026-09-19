package com.politikapp.backend.submission.service;

import com.politikapp.backend.submission.dto.SubmissionResponse;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import org.springframework.stereotype.Component;

@Component
public class SubmissionMapper {
    public SubmissionResponse toResponse(ProfileEditSubmission submission, String message) {
        return new SubmissionResponse(
                submission.getSubmissionId(),
                submission.getPoliticianId(),
                submission.getContributorId(),
                submission.getSourceUrl(),
                submission.getCategoryTag(),
                submission.getActionIdentifier(),
                submission.getActionDetails(),
                submission.getImpactSummary(),
                submission.getStatus(),
                message,
                submission.getCreatedAt()
        );
    }
}
