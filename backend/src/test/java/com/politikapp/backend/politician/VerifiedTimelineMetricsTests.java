package com.politikapp.backend.politician;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.politician.service.DashboardMetricsService;
import com.politikapp.backend.politician.service.PoliticianMapper;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VerifiedTimelineMetricsTests {
    @Test
    void directoryAndDashboardIncludeVerifiedCongressOnceAndExcludeSourceReportedClaims() {
        var submissions = mock(ProfileEditSubmissionRepository.class);
        var timelines = mock(TimelineEntryRepository.class);
        var person = new Politician();
        person.setPoliticianId(UUID.randomUUID());
        person.setPosition("SENATOR");
        var curated = new ProfileEditSubmission();
        curated.setActionIdentifier("SPONSORED_LEGISLATION");
        curated.setActionDetails(Map.of("legislativeStatus", "Filed"));
        var linked = new TimelineEntry();
        linked.setSubmissionId(UUID.randomUUID());
        linked.setActionIdentifier("SPONSORED_LEGISLATION");
        var verified = new TimelineEntry();
        verified.setActionIdentifier("SPONSORED_LEGISLATION");
        verified.setActionDetails(Map.of("openCongressId", "fixture-bill", "legislativeStatus", "FILED"));
        var unverified = new TimelineEntry();
        unverified.setActionIdentifier("SPONSORED_LEGISLATION");
        unverified.setActionDetails(Map.of("sourceReported", true));
        when(submissions.findByPoliticianIdAndStatus(person.getPoliticianId(), "PUBLISHED")).thenReturn(List.of(curated));
        when(timelines.findActiveEntries(person.getPoliticianId(), "PUBLISHED")).thenReturn(List.of(linked, verified, unverified));
        var metrics = new DashboardMetricsService(submissions, timelines);
        var directory = new PoliticianMapper(submissions, metrics).toResponse(person);
        var dashboard = metrics.buildKpiPayload(person);
        assertEquals(2, directory.billsAuthored());
        assertEquals(directory.billsAuthored(), dashboard.billsAuthored());
        assertEquals(directory.wgiCompositeScore(), dashboard.wgiCompositeScore());
    }
}
