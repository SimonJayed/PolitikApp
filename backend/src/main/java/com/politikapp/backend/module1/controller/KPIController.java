package com.politikapp.backend.module1.controller;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.SymmetricalKpiPayload;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.service.DashboardMetricsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/politicians")
@CrossOrigin(origins = "*")
public class KPIController {
    private final PoliticianRepository politicianRepository;
    private final DashboardMetricsService dashboardMetricsService;

    public KPIController(
            PoliticianRepository politicianRepository,
            DashboardMetricsService dashboardMetricsService
    ) {
        this.politicianRepository = politicianRepository;
        this.dashboardMetricsService = dashboardMetricsService;
    }

    @GetMapping("/{politicianId}/kpis")
    public ResponseEntity<SymmetricalKpiPayload> getKpis(@PathVariable UUID politicianId) {
        Politician politician = politicianRepository.findById(politicianId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Target profile record does not exist."));
        return ResponseEntity.ok(dashboardMetricsService.buildKpiPayload(politician));
    }
}
