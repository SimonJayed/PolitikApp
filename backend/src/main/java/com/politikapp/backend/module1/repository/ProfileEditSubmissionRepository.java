package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for managing {@link ProfileEditSubmission} entities.
 * Acts as the {@code SubmissionRepository} specification defined in the SDD blueprint.
 */
public interface ProfileEditSubmissionRepository extends JpaRepository<ProfileEditSubmission, UUID> {
    List<ProfileEditSubmission> findByPoliticianIdAndStatus(UUID politicianId, String status);
    List<ProfileEditSubmission> findByContributorId(UUID contributorId);
}
