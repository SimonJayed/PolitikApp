package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.WikidataImportResponse;
import com.politikapp.backend.module1.service.WikidataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/import/wikidata")
public class WikidataImportController {
    private final WikidataService wikidataService;

    public WikidataImportController(WikidataService wikidataService) {
        this.wikidataService = wikidataService;
    }

    @PostMapping("/politicians")
    public ResponseEntity<WikidataImportResponse> importPoliticians() {
        return ResponseEntity.ok(wikidataService.importPoliticians());
    }
}
