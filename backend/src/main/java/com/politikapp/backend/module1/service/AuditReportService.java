package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditReportService {
    private final ProfileEditSubmissionRepository submissionRepository;

    public AuditReportService(ProfileEditSubmissionRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    @Transactional(readOnly = true)
    public List<ProfileEditSubmission> getAuditReports(UUID politicianId) {
        List<ProfileEditSubmission> submissions = submissionRepository.findByPoliticianIdAndStatus(politicianId, "PUBLISHED");
        return filterAuditFindings(submissions);
    }

    public List<ProfileEditSubmission> filterAuditFindings(List<ProfileEditSubmission> submissions) {
        return submissions.stream()
                .filter(s -> "COA_FINDING".equals(s.getActionIdentifier()))
                .toList();
    }

    public String summarizeAuditReports(List<ProfileEditSubmission> auditFindings) {
        return "Total COA audit discrepancies found: " + auditFindings.size();
    }
}
