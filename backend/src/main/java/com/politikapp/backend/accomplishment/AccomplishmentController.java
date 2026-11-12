package com.politikapp.backend.accomplishment;

import com.politikapp.backend.accomplishment.AccomplishmentDtos.Response;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/politicians/{politicianId}/accomplishments")
public class AccomplishmentController {
    private final AccomplishmentService service;
    public AccomplishmentController(AccomplishmentService service) { this.service = service; }

    @GetMapping
    public List<Response> list(@PathVariable UUID politicianId) { return service.list(politicianId, false); }

    @GetMapping("/{id}")
    public Response get(@PathVariable UUID politicianId, @PathVariable UUID id) { return service.get(politicianId, id); }
}
