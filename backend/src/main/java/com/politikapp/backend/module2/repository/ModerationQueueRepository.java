package com.politikapp.backend.module2.repository;

import com.politikapp.backend.module2.entity.ModerationQueue;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ModerationQueueRepository extends JpaRepository<ModerationQueue, UUID> {
    Optional<ModerationQueue> findBySubmissionId(UUID submissionId);
}
