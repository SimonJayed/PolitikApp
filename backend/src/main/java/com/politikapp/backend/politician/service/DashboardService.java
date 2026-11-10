package com.politikapp.backend.politician.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.dto.DashboardCompositeResponse;
import com.politikapp.backend.politician.dto.DashboardCompositeResponse.ProfileNewsItem;
import com.politikapp.backend.politician.dto.SymmetricalKpiPayload;
import com.politikapp.backend.politician.dto.TimelineEntryResponse;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("null")
public class DashboardService {
    private final PoliticianRepository politicianRepository;
    private final TimelineEntryRepository timelineEntryRepository;
    private final DashboardMetricsService dashboardMetricsService;
    private final TimelineMapper timelineMapper;
    private final JdbcTemplate jdbc;

    public DashboardService(
            PoliticianRepository politicianRepository,
            TimelineEntryRepository timelineEntryRepository,
            DashboardMetricsService dashboardMetricsService,
            TimelineMapper timelineMapper, JdbcTemplate jdbc
    ) {
        this.politicianRepository = politicianRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.dashboardMetricsService = dashboardMetricsService;
        this.timelineMapper = timelineMapper;
        this.jdbc = jdbc;
    }

    public DashboardCompositeResponse getDashboardData(UUID politicianId) {
        Politician politician = politicianRepository.findById(politicianId)
                .filter(p -> !"ARCHIVED".equals(p.getStatus()))
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target profile record does not exist."));

        SymmetricalKpiPayload kpis = dashboardMetricsService.buildKpiPayload(politician);
        List<TimelineEntryResponse> timeline = timelineEntryRepository
                .findActiveEntries(politicianId, "PUBLISHED")
                .stream()
                .map(timelineMapper::toResponse)
                .toList();
        List<ProfileNewsItem> news = jdbc.query("""
                select n.id, coalesce(nullif(n.suggested_title, ''), n.original_title),
                       s.name, n.source_url, n.ai_summary, n.published_at
                from public.news_articles n
                join public.news_politicians np on np.news_id = n.id
                join public.government_sources s on s.id = n.source_id
                where np.politician_id = ? and n.status = 'PUBLISHED'
                  and n.reviewed_at is not null and n.published_at is not null
                order by n.published_at desc limit 10
                """, (row, index) -> new ProfileNewsItem(
                row.getObject(1, UUID.class), row.getString(2), row.getString(3),
                row.getString(4), row.getString(5), row.getTimestamp(6).toInstant()), politicianId);

        return new DashboardCompositeResponse(
                kpis.politicianId(),
                kpis.fullName(),
                kpis.position(),
                kpis.jurisdiction(),
                kpis.partyAffiliation(),
                politician.getTermStart(),
                politician.getTermEnd(),
                politician.getProfileImageUrl(),
                politician.getBiography(),
                kpis.billsAuthored(),
                kpis.projectCompletions(),
                kpis.legislativeEfficiencyRatio(),
                kpis.coaAuditDiscrepancies(),
                kpis.trackedBudgetAllocated(),
                kpis.wgiCompositeScore(),
                timeline,
                news,
                politician.getProfileOrigin()
        );
    }
}
