package com.politikapp.backend.congress;

import static com.politikapp.backend.congress.LegislativeAccountability.*;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
class LegislativeAccountabilityController {
    private static final String PUBLIC = "/api/politicians/{politicianId}/legislative-accountability";
    private static final String ADMIN = "/api/admin/politicians/{politicianId}/legislative-accountability";
    private final LegislativeAccountabilityService service;
    private final boolean enabled;

    LegislativeAccountabilityController(LegislativeAccountabilityService service,
            @Value("${app.legislative-accountability.enabled:false}") boolean enabled) {
        this.service = service;
        this.enabled = enabled;
    }

    record Query(Kind kind, Chamber chamber, @Min(8) @Max(200) Integer congress,
                 @Min(0) @Max(1_000_000) Integer offset, @Min(1) @Max(100) Integer limit) {
        Filter filter() {
            return new Filter(kind, chamber, congress, offset == null ? 0 : offset, limit == null ? 20 : limit);
        }
    }

    @GetMapping(PUBLIC)
    Page<Entry> listPublic(@PathVariable UUID politicianId, @Valid @ModelAttribute Query query) {
        return enabled ? service.listPublic(politicianId, query.filter())
                : new Page<>(false, List.of(), List.of(), query.filter().offset(), false);
    }

    @GetMapping(PUBLIC + "/{id}")
    Entry getPublic(@PathVariable UUID politicianId, @PathVariable UUID id) {
        requireEnabled();
        return service.getPublic(politicianId, id);
    }

    @GetMapping(ADMIN)
    @PreAuthorize("hasRole('ADMIN')")
    Page<AdminEntry> listAdmin(@PathVariable UUID politicianId, @Valid @ModelAttribute Query query) {
        requireEnabled();
        return service.listAdmin(politicianId, query.filter());
    }

    @PostMapping(ADMIN)
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<AdminEntry> create(@PathVariable UUID politicianId, @Valid @RequestBody Input input,
            @AuthenticationPrincipal AuthPrincipal principal) {
        requireEnabled();
        AdminEntry entry = service.create(politicianId, input, admin(principal));
        return ResponseEntity.created(URI.create(PUBLIC.replace("{politicianId}", politicianId.toString())
                + "/" + entry.record().recordId())).body(entry);
    }

    @PutMapping(ADMIN + "/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    AdminEntry update(@PathVariable UUID politicianId, @PathVariable UUID id, @Valid @RequestBody Input input,
            @AuthenticationPrincipal AuthPrincipal principal) {
        requireEnabled();
        return service.update(politicianId, id, input, admin(principal));
    }

    @DeleteMapping(ADMIN + "/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<Void> withdraw(@PathVariable UUID politicianId, @PathVariable UUID id,
            @RequestParam(required = false) Long revision) {
        requireEnabled();
        if (revision == null || revision < 0) throw new HttpResponseException(400, "Include a valid record revision.");
        service.withdraw(politicianId, id, revision);
        return ResponseEntity.noContent().build();
    }

    private static UUID admin(AuthPrincipal principal) {
        if (principal == null) throw new HttpResponseException(401, "Sign in as an administrator.");
        return principal.getUserId();
    }

    private void requireEnabled() {
        if (!enabled) throw new HttpResponseException(503, "Legislative accountability is temporarily unavailable.");
    }
}
