package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.TimelineEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimelineEntryRepository extends JpaRepository<TimelineEntry, UUID> {
    List<TimelineEntry> findByPoliticianIdAndPublicationStatusOrderByCreatedAtDesc(
            UUID politicianId,
            String publicationStatus
    );
}
