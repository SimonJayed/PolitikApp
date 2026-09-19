package com.politikapp.backend.curation;

import com.politikapp.backend.curation.dto.AdminCurationDtos.AdjudicationQueueCardResponse;
import com.politikapp.backend.curation.dto.AdminCurationSummaryResponse;
import com.politikapp.backend.curation.entity.ModerationQueue;
import com.politikapp.backend.curation.repository.ModerationQueueRepository;
import com.politikapp.backend.curation.service.AdminCurationService;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminCurationServiceTests {

    @Mock
    private PoliticianRepository politicianRepository;

    @Mock
    private ProfileEditSubmissionRepository submissionRepository;

    @Mock
    private TimelineEntryRepository timelineEntryRepository;

    @Mock
    private ModerationQueueRepository moderationQueueRepository;

    private AdminCurationService adminCurationService;

    @BeforeEach
    void setUp() {
        adminCurationService = new AdminCurationService(
                politicianRepository,
                submissionRepository,
                timelineEntryRepository,
                moderationQueueRepository
        );
    }

    @Test
    void getAdjudicationSummary_computesCountsDirectly() {
        when(moderationQueueRepository.countByQueueStatusIn(anyList())).thenReturn(4L);
        when(moderationQueueRepository.countByQueueStatus("RESOLVED_UPHELD")).thenReturn(12L);
        when(moderationQueueRepository.countByQueueStatus("RESOLVED_DISMISSED")).thenReturn(2L);
        when(timelineEntryRepository.countByPublicationStatusAndIsHiddenFalse("PUBLISHED")).thenReturn(45L);

        AdminCurationSummaryResponse summary = adminCurationService.getAdjudicationSummary();

        assertNotNull(summary);
        assertEquals(4L, summary.pendingAdjudications());
        assertEquals(12L, summary.upheldRulings());
        assertEquals(2L, summary.dismissedRulings());
        assertEquals(45L, summary.totalCuratedRecords());

        verify(moderationQueueRepository, times(1)).countByQueueStatusIn(anyList());
        verify(timelineEntryRepository, times(1)).countByPublicationStatusAndIsHiddenFalse("PUBLISHED");
    }

    @Test
    void getAdjudicationQueue_batchFetchesSubmissionsAndPoliticiansWithoutNPlusOne() {
        UUID sub1 = UUID.randomUUID();
        UUID sub2 = UUID.randomUUID();
        UUID pol1 = UUID.randomUUID();

        ModerationQueue q1 = new ModerationQueue();
        q1.setSubmissionId(sub1);
        q1.setPoliticianId(pol1);
        q1.setQueueStatus("SUBMITTED_REQUEST");

        ModerationQueue q2 = new ModerationQueue();
        q2.setSubmissionId(sub2);
        q2.setPoliticianId(pol1);
        q2.setQueueStatus("UNDER_REVIEW");

        when(moderationQueueRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(q1, q2));

        Politician politician = new Politician();
        politician.setPoliticianId(pol1);
        politician.setFullName("Test Leader");

        ProfileEditSubmission s1 = new ProfileEditSubmission();
        s1.setSubmissionId(sub1);
        s1.setCategoryTag("Infrastructure");
        s1.setActionIdentifier("PROJECT_COMPLETION");

        ProfileEditSubmission s2 = new ProfileEditSubmission();
        s2.setSubmissionId(sub2);
        s2.setCategoryTag("Legislation");
        s2.setActionIdentifier("SPONSORED_LEGISLATION");

        when(politicianRepository.findAllById(any())).thenReturn(List.of(politician));
        when(submissionRepository.findAllById(any())).thenReturn(List.of(s1, s2));

        List<AdjudicationQueueCardResponse> result = adminCurationService.getAdjudicationQueue("ALL");

        assertEquals(2, result.size());
        assertEquals("Test Leader", result.get(0).politicianName());
        assertEquals("Test Leader", result.get(1).politicianName());

        // Verify batch queries were executed rather than individual findById calls
        verify(submissionRepository, times(1)).findAllById(any());
        verify(politicianRepository, times(1)).findAllById(any());
        verify(submissionRepository, never()).findById(any());
        verify(politicianRepository, never()).findById(any());
    }
}
