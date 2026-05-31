package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectAllocationService {
    private final ProfileEditSubmissionRepository submissionRepository;

    public ProjectAllocationService(ProfileEditSubmissionRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    @Transactional(readOnly = true)
    public List<ProfileEditSubmission> getProjectAllocations(UUID politicianId) {
        return submissionRepository.findByPoliticianIdAndStatus(politicianId, "PUBLISHED");
    }

    public BigDecimal calculateTotalBudget(List<ProfileEditSubmission> allocations) {
        return allocations.stream()
                .filter(submission -> "BUDGET_ALLOCATION".equals(submission.getActionIdentifier()))
                .map(this::allocationAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public List<ProfileEditSubmission> filterProjectStatus(List<ProfileEditSubmission> allocations, String status) {
        return allocations.stream()
                .filter(submission -> status.equalsIgnoreCase(submission.getStatus()))
                .toList();
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
