package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.TimelineEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TimelineEntryRepository extends JpaRepository<TimelineEntry, UUID> {
    @Query("SELECT t FROM TimelineEntry t WHERE t.politicianId = :politicianId AND t.publicationStatus = :publicationStatus AND t.isHidden = false ORDER BY t.createdAt DESC")
    List<TimelineEntry> findActiveEntries(UUID politicianId, String publicationStatus);

    @Modifying
    @Query("UPDATE TimelineEntry t SET t.isHidden = true, t.updatedAt = CURRENT_INSTANT WHERE t.submissionId = :submissionId")
    void softDeleteBySubmissionId(UUID submissionId);
}
