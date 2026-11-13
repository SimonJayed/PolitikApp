package com.politikapp.backend.politician.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.dto.AlignedComparisonRow;
import com.politikapp.backend.politician.dto.ComparisonMatrixResponse;
import com.politikapp.backend.politician.dto.SymmetricalKpiPayload;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
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
                .filter(p -> !"ARCHIVED".equals(p.getStatus()))
                .orElseThrow(() -> missingProfileException());
        Politician politicianB = politicianRepository.findById(idB)
                .filter(p -> !"ARCHIVED".equals(p.getStatus()))
                .orElseThrow(() -> missingProfileException());

        String positionA = comparisonPosition(politicianA.getPosition());
        if (positionA.isBlank() || !positionA.equals(comparisonPosition(politicianB.getPosition()))) {
            throw new HttpResponseException(400, "Choose two politicians with the same position.");
        }

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

    private String comparisonPosition(String value) {
        String position = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
        return switch (position) {
            case "SENATE" -> "SENATOR";
            case "HOUSE", "REPRESENTATIVE", "HOUSE_OF_REPRESENTATIVES", "CONGRESSMAN", "CONGRESSWOMAN" -> "HOUSE_REPRESENTATIVE";
            case "VICE_PRES" -> "VICE_PRESIDENT";
            default -> position;
        };
    }
}
