package com.politikapp.backend.politician.controller;

import com.politikapp.backend.politician.dto.ComparisonMatrixResponse;
import com.politikapp.backend.politician.dto.DashboardCompositeResponse;
import com.politikapp.backend.politician.service.ComparisonService;
import com.politikapp.backend.politician.service.DashboardService;
import com.politikapp.backend.congress.CongressPublicService;
import com.politikapp.backend.congress.OriginalSourceService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/politicians")
public class PoliticianDashboardController {
    private final DashboardService dashboardService;
    private final ComparisonService comparisonService;
    private final CongressPublicService congressPublicService;
    private final OriginalSourceService originalSources;

    public PoliticianDashboardController(DashboardService dashboardService, ComparisonService comparisonService,
                                         CongressPublicService congressPublicService, OriginalSourceService originalSources) {
        this.dashboardService = dashboardService;
        this.comparisonService = comparisonService;
        this.congressPublicService = congressPublicService;
        this.originalSources = originalSources;
    }

    @GetMapping("/{politicianId}/dashboard")
    public ResponseEntity<DashboardCompositeResponse> getDashboard(@PathVariable UUID politicianId) {
        return ResponseEntity.ok(dashboardService.getDashboardData(politicianId));
    }

    @GetMapping("/{politicianId}/congress-records")
    public CongressPublicService.Page congressRecords(@PathVariable UUID politicianId,
            @RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) Integer congress, @RequestParam(defaultValue = "false") boolean checkSources) {
        var page = congressPublicService.publicRecords(politicianId, offset, limit, congress);
        return checkSources ? originalSources.checkPage(page) : page;
    }

    @GetMapping("/compare")
    public ResponseEntity<ComparisonMatrixResponse> comparePoliticians(
            @RequestParam UUID idA,
            @RequestParam UUID idB
    ) {
        return ResponseEntity.ok(comparisonService.executeSideBySideComparison(idA, idB));
    }
}
