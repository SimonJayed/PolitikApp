package com.politikapp.backend.accomplishment;

import com.politikapp.backend.accomplishment.AccomplishmentDtos.*;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/politicians/{politicianId}/accomplishments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAccomplishmentController {
    private final AccomplishmentService service;
    public AdminAccomplishmentController(AccomplishmentService service) { this.service = service; }

    @GetMapping
    public List<Response> list(@PathVariable UUID politicianId) { return service.list(politicianId, true); }

    @PostMapping
    public ResponseEntity<Response> create(@PathVariable UUID politicianId, @Valid @RequestBody UpsertRequest request) {
        var entry = service.create(politicianId, request);
        return ResponseEntity.created(URI.create("/api/politicians/" + politicianId + "/accomplishments/"
                + entry.accomplishmentId())).body(entry);
    }

    @PutMapping("/{id}")
    public Response update(@PathVariable UUID politicianId, @PathVariable UUID id,
            @Valid @RequestBody UpsertRequest request) { return service.update(politicianId, id, request); }

    /** Hide without deleting the record, citation, or timestamps. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> hide(@PathVariable UUID politicianId, @PathVariable UUID id) {
        service.hide(politicianId, id);
        return ResponseEntity.noContent().build();
    }
}
