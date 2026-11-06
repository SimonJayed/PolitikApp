package com.politikapp.backend.politician.controller;

import com.politikapp.backend.politician.dto.ComparisonMatrixResponse;
import com.politikapp.backend.politician.dto.DashboardCompositeResponse;
import com.politikapp.backend.politician.service.ComparisonService;
import com.politikapp.backend.politician.service.DashboardService;
import com.politikapp.backend.congress.CongressPublicService;
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

    public PoliticianDashboardController(DashboardService dashboardService, ComparisonService comparisonService,
                                         CongressPublicService congressPublicService) {
        this.dashboardService = dashboardService;
        this.comparisonService = comparisonService;
        this.congressPublicService = congressPublicService;
    }

    @GetMapping("/{politicianId}/dashboard")
    public ResponseEntity<DashboardCompositeResponse> getDashboard(@PathVariable UUID politicianId) {
        return ResponseEntity.ok(dashboardService.getDashboardData(politicianId));
    }

    @GetMapping("/{politicianId}/congress-records")
    public CongressPublicService.Page congressRecords(@PathVariable UUID politicianId,
            @RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit) {
        return congressPublicService.publicRecords(politicianId, offset, limit);
    }

    @GetMapping("/compare")
    public ResponseEntity<ComparisonMatrixResponse> comparePoliticians(
            @RequestParam UUID idA,
            @RequestParam UUID idB
    ) {
        return ResponseEntity.ok(comparisonService.executeSideBySideComparison(idA, idB));
    }
}
