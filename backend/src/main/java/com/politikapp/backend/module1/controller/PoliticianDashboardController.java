package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.ComparisonMatrixResponse;
import com.politikapp.backend.module1.dto.DashboardCompositeResponse;
import com.politikapp.backend.module1.service.ComparisonService;
import com.politikapp.backend.module1.service.DashboardService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/politicians")
@CrossOrigin(origins = "*")
public class PoliticianDashboardController {
    private final DashboardService dashboardService;
    private final ComparisonService comparisonService;

    public PoliticianDashboardController(DashboardService dashboardService, ComparisonService comparisonService) {
        this.dashboardService = dashboardService;
        this.comparisonService = comparisonService;
    }

    @GetMapping("/{politicianId}/dashboard")
    public ResponseEntity<DashboardCompositeResponse> getDashboard(@PathVariable UUID politicianId) {
        return ResponseEntity.ok(dashboardService.getDashboardData(politicianId));
    }

    @GetMapping("/compare")
    public ResponseEntity<ComparisonMatrixResponse> comparePoliticians(
            @RequestParam UUID idA,
            @RequestParam UUID idB
    ) {
        return ResponseEntity.ok(comparisonService.executeSideBySideComparison(idA, idB));
    }
}
