package com.politikapp.backend.module1.controller;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.PoliticianResponse;
import com.politikapp.backend.module1.dto.UpdatePoliticianRequest;
import com.politikapp.backend.module1.service.PoliticianService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/politicians")
public class PoliticianController {
    private final PoliticianService politicianService;
    private final AuthUserRepository authUserRepository;

    public PoliticianController(PoliticianService politicianService, AuthUserRepository authUserRepository) {
        this.politicianService = politicianService;
        this.authUserRepository = authUserRepository;
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

    @PutMapping("/{id}")
    public ResponseEntity<PoliticianResponse> updatePolitician(
            @PathVariable UUID id,
            @RequestBody UpdatePoliticianRequest updates,
            Authentication authentication
    ) {
        assertDatabaseAdmin(authentication);
        return ResponseEntity.ok(politicianService.updatePolitician(id, updates));
    }

    private void assertDatabaseAdmin(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            throw new HttpResponseException(401, "Authentication required.");
        }

        AuthUser user = authUserRepository.findById(principal.getUserId())
                .orElseThrow(() -> new HttpResponseException(401, "Authenticated account not found."));
        if (!"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new HttpResponseException(403, "Forbidden: only database administrators can edit politician profiles.");
        }
    }
}
