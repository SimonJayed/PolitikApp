package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.DashboardCompositeResponse;
import com.politikapp.backend.module1.dto.SymmetricalKpiPayload;
import com.politikapp.backend.module1.dto.TimelineEntryResponse;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("null")
public class DashboardService {
    private final PoliticianRepository politicianRepository;
    private final TimelineService timelineService;
    private final DashboardMetricsService dashboardMetricsService;

    public DashboardService(
            PoliticianRepository politicianRepository,
            TimelineService timelineService,
            DashboardMetricsService dashboardMetricsService
    ) {
        this.politicianRepository = politicianRepository;
        this.timelineService = timelineService;
        this.dashboardMetricsService = dashboardMetricsService;
    }

    public DashboardCompositeResponse getDashboardData(UUID politicianId) {
        Politician politician = politicianRepository.findById(politicianId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target profile record does not exist."));

        SymmetricalKpiPayload kpis = dashboardMetricsService.buildKpiPayload(politician);
        List<TimelineEntryResponse> timeline = timelineService.getPublishedTimelineEntries(politicianId);

        return new DashboardCompositeResponse(
                kpis.politicianId(),
                kpis.fullName(),
                kpis.position(),
                kpis.jurisdiction(),
                kpis.partyAffiliation(),
                politician.getProfileImageUrl(),
                politician.getBiography(),
                kpis.billsAuthored(),
                kpis.projectCompletions(),
                kpis.legislativeEfficiencyRatio(),
                kpis.coaAuditDiscrepancies(),
                kpis.trackedBudgetAllocated(),
                kpis.wgiCompositeScore(),
                timeline
        );
    }
}
