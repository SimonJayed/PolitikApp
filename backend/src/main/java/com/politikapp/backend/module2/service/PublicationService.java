package com.politikapp.backend.module2.service;

import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.entity.TimelineEntry;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicationService {
    private static final Logger log = LoggerFactory.getLogger(PublicationService.class);
    private final TimelineEntryRepository timelineEntryRepository;

    public PublicationService(TimelineEntryRepository timelineEntryRepository) {
        this.timelineEntryRepository = timelineEntryRepository;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void executePublicationTrigger(ProfileEditSubmission submission) {
        publishApprovedEntry(submission);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void publishApprovedEntry(ProfileEditSubmission submission) {
        log.info("Publishing approved entry for submission ID={}", submission.getSubmissionId());
        createTimelineEntry(submission);
        updatePoliticianProfile(submission.getPoliticianId());
        updateKPIValues(submission.getPoliticianId());
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void createTimelineEntry(ProfileEditSubmission submission) {
        try {
            timelineEntryRepository.save(TimelineEntry.publishedFrom(submission));
            log.info("Successfully persisted timeline ledger record for politician ID={}", submission.getPoliticianId());
        } catch (Exception e) {
            log.error("Failed to cascade verified edits to timeline: {}", e.getMessage());
        }
    }

    public void updatePoliticianProfile(UUID politicianId) {
        // Handled dynamically on read in PolitikApp consolidated model
    }

    public void updateKPIValues(UUID politicianId) {
        // Handled dynamically on read in PolitikApp consolidated model
    }
}
