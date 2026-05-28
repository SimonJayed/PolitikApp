package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.AlignedComparisonRow;
import com.politikapp.backend.module1.dto.ComparisonMatrixResponse;
import com.politikapp.backend.module1.dto.SymmetricalKpiPayload;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.TimelineEntry;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("null")
public class ComparisonService {
    private final PoliticianRepository politicianRepository;
    private final TimelineEntryRepository timelineEntryRepository;
    private final DashboardMetricsService dashboardMetricsService;
    private final TimelineMapper timelineMapper;

    public ComparisonService(
            PoliticianRepository politicianRepository,
            TimelineEntryRepository timelineEntryRepository,
            DashboardMetricsService dashboardMetricsService,
            TimelineMapper timelineMapper
    ) {
        this.politicianRepository = politicianRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.dashboardMetricsService = dashboardMetricsService;
        this.timelineMapper = timelineMapper;
    }

    public ComparisonMatrixResponse executeSideBySideComparison(UUID idA, UUID idB) {
        if (idA.equals(idB)) {
            throw new HttpResponseException(400, "Bad Request: Cannot compare identical profile entities.");
        }

        Politician politicianA = politicianRepository.findById(idA)
                .orElseThrow(() -> missingProfileException());
        Politician politicianB = politicianRepository.findById(idB)
                .orElseThrow(() -> missingProfileException());

        List<TimelineEntry> streamA = timelineEntryRepository
                .findActiveEntries(idA, "PUBLISHED");
        List<TimelineEntry> streamB = timelineEntryRepository
                .findActiveEntries(idB, "PUBLISHED");

        return new ComparisonMatrixResponse(
                mapToSymmetricalKpiPayload(politicianA),
                mapToSymmetricalKpiPayload(politicianB),
                alignByCategory(streamA, streamB)
        );
    }

    private SymmetricalKpiPayload mapToSymmetricalKpiPayload(Politician politician) {
        return dashboardMetricsService.buildKpiPayload(politician);
    }

    private List<AlignedComparisonRow> alignByCategory(List<TimelineEntry> streamA, List<TimelineEntry> streamB) {
        Set<String> categories = new HashSet<>();
        streamA.forEach(entry -> categories.add(entry.getCategoryTag()));
        streamB.forEach(entry -> categories.add(entry.getCategoryTag()));

        List<AlignedComparisonRow> rows = new ArrayList<>();
        for (String category : categories) {
            rows.add(new AlignedComparisonRow(
                    category,
                    streamA.stream()
                            .filter(entry -> category.equals(entry.getCategoryTag()))
                            .map(timelineMapper::toResponse)
                            .toList(),
                    streamB.stream()
                            .filter(entry -> category.equals(entry.getCategoryTag()))
                            .map(timelineMapper::toResponse)
                            .toList()
            ));
        }
        return rows;
    }

    private HttpResponseException missingProfileException() {
        return new HttpResponseException(404, "Not Found: One or both requested profiles are missing.");
    }
}
