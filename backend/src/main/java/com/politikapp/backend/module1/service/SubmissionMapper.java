package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.SubmissionResponse;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
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
                submission.getQuantitativeMetric(),
                submission.getImpactSummary(),
                submission.getStatus(),
                message,
                submission.getCreatedAt()
        );
    }
}
