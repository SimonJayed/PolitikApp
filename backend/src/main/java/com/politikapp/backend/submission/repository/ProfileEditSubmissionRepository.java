package com.politikapp.backend.submission.repository;

import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileEditSubmissionRepository extends JpaRepository<ProfileEditSubmission, UUID> {
    List<ProfileEditSubmission> findByPoliticianIdAndStatus(UUID politicianId, String status);
    List<ProfileEditSubmission> findByContributorId(UUID contributorId);
    List<ProfileEditSubmission> findByPoliticianIdInAndStatus(Collection<UUID> politicianIds, String status);
    List<ProfileEditSubmission> findByStatus(String status);
}
