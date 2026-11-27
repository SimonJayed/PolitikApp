package com.politikapp.backend.submission.repository;

import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProfileEditSubmissionRepository extends JpaRepository<ProfileEditSubmission, UUID> {
    // Older submissions may have no ledger entry. A linked allocation needs a visible published budget entry.
    String ELIGIBLE_BUDGET = """
            and (s.status <> 'PUBLISHED' or s.actionIdentifier <> 'BUDGET_ALLOCATION'
                or not exists (select 1 from TimelineEntry t where t.submissionId = s.submissionId)
                or exists (select 1 from TimelineEntry t where t.submissionId = s.submissionId
                    and t.politicianId = s.politicianId and t.publicationStatus = 'PUBLISHED'
                    and t.isHidden = false and t.actionIdentifier = 'BUDGET_ALLOCATION'))
            """;

    @Query("select s from ProfileEditSubmission s where s.politicianId = :politicianId and s.status = :status " + ELIGIBLE_BUDGET)
    List<ProfileEditSubmission> findByPoliticianIdAndStatus(UUID politicianId, String status);
    List<ProfileEditSubmission> findByContributorId(UUID contributorId);
    @Query("select s from ProfileEditSubmission s where s.politicianId in :politicianIds and s.status = :status " + ELIGIBLE_BUDGET)
    List<ProfileEditSubmission> findByPoliticianIdInAndStatus(Collection<UUID> politicianIds, String status);
    List<ProfileEditSubmission> findByStatus(String status);
}
