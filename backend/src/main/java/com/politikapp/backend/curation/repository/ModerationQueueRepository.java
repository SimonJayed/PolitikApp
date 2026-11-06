package com.politikapp.backend.curation.repository;

import com.politikapp.backend.curation.entity.ModerationQueue;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ModerationQueueRepository extends JpaRepository<ModerationQueue, UUID> {
    Optional<ModerationQueue> findBySubmissionId(UUID submissionId);

    List<ModerationQueue> findByQueueStatusInOrderByCreatedAtDesc(List<String> statuses);

    List<ModerationQueue> findAllByOrderByCreatedAtDesc();

    List<ModerationQueue> findByPoliticianIdOrderByCreatedAtDesc(UUID politicianId);

    List<ModerationQueue> findByChallengeTargetId(UUID challengeTargetId);

    long countByQueueStatusIn(List<String> statuses);

    long countByQueueStatus(String status);
}
