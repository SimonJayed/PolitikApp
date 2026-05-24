package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.PoliticianResponse;
import com.politikapp.backend.module1.service.PoliticianService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/politicians")
public class PoliticianController {
    private final PoliticianService politicianService;

    public PoliticianController(PoliticianService politicianService) {
        this.politicianService = politicianService;
    }

    @GetMapping
    public ResponseEntity<List<PoliticianResponse>> getPoliticians() {
        return ResponseEntity.ok(politicianService.getActivePoliticians());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PoliticianResponse> getPolitician(@PathVariable UUID id) {
        return ResponseEntity.ok(politicianService.getPolitician(id));
    }

    @GetMapping("/search")
    public ResponseEntity<List<PoliticianResponse>> searchPoliticians(@RequestParam String name) {
        return ResponseEntity.ok(politicianService.searchPoliticians(name));
    }
}
