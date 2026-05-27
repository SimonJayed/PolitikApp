package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.PoliticianResponse;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class PoliticianMapper {
    private final ProfileEditSubmissionRepository submissionRepository;

    public PoliticianMapper(ProfileEditSubmissionRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    public PoliticianResponse toResponse(Politician politician) {
        List<ProfileEditSubmission> submissions = submissionRepository
                .findByPoliticianIdAndStatus(politician.getPoliticianId(), "PUBLISHED");

        long billsAuthored = countByAction(submissions, "SPONSORED_LEGISLATION");
        long projectCompletions = countByAction(submissions, "PROJECT_COMPLETION");
        int coaDiscrepancies = Math.toIntExact(countByAction(submissions, "COA_FINDING"));
        
        BigDecimal totalBudget = submissions.stream()
                .filter(submission -> "BUDGET_ALLOCATION".equals(submission.getActionIdentifier()))
                .map(this::allocationAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double efficiencyRatio = 0.0;
        try {
            if (billsAuthored > 0) {
                efficiencyRatio = ((double) projectCompletions / billsAuthored) * 100.0;
            } else {
                efficiencyRatio = 0.0;
            }
        } catch (ArithmeticException | NullPointerException e) {
            efficiencyRatio = 0.0;
        }

        return new PoliticianResponse(
                politician.getPoliticianId(),
                politician.getFullName(),
                politician.getPosition(),
                politician.getJurisdiction(),
                politician.getPartyAffiliation(),
                politician.getTermStart(),
                politician.getTermEnd(),
                politician.getProfileImageUrl(),
                politician.getBiography(),
                politician.getStatus(),
                efficiencyRatio,
                coaDiscrepancies,
                totalBudget
        );
    }

    private long countByAction(List<ProfileEditSubmission> submissions, String actionIdentifier) {
        return submissions.stream()
                .filter(submission -> actionIdentifier.equals(submission.getActionIdentifier()))
                .count();
    }

    private BigDecimal allocationAmount(ProfileEditSubmission submission) {
        Map<String, Object> details = submission.getActionDetails();
        if (details == null || !details.containsKey("allocationAmount")) {
            return BigDecimal.ZERO;
        }
        Object value = details.get("allocationAmount");
        if (value == null) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }
}
