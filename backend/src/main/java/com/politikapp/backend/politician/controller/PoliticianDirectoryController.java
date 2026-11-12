package com.politikapp.backend.politician.controller;

import com.politikapp.backend.congress.CongressDirectoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PoliticianDirectoryController {
    private final CongressDirectoryService service;
    public PoliticianDirectoryController(CongressDirectoryService service) { this.service = service; }

    @GetMapping("/api/politicians/directory-memberships")
    public CongressDirectoryService.Directory memberships() { return service.directory(); }
}
