package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.politikapp.backend.politician.dto.CreatePoliticianRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/open-congress")
@PreAuthorize("hasRole('ADMIN')")
public class CongressController {
    public record LinkRequest(@NotNull UUID politicianId, @NotBlank String evidenceUrl,
                              @NotBlank String verificationNotes) {}
    public record DraftRequest(@NotBlank String personId) {}
    public record PublishDraftRequest(@NotBlank String sourceUrl, @NotBlank String verificationNotes,
                                      @NotBlank String verifiedStatus, @NotBlank String summary) {}
    public record ApproveSourceUpdatesRequest(@NotNull List<String> keys) {}
    private final CongressImportService imports;
    private final CongressStore store;
    private final CongressProfileService profiles;
    private final CongressPreview previews;
    private final CongressBulkLinkPreview bulkPreview;
    private final CongressBulkLinkService bulkLinks;
    private final CongressPublicService publicRecords;

    public CongressController(CongressImportService imports, CongressStore store, CongressProfileService profiles,
                              CongressPreview previews, CongressBulkLinkPreview bulkPreview,
                              CongressBulkLinkService bulkLinks, CongressPublicService publicRecords) {
        this.imports = imports;
        this.store = store;
        this.profiles = profiles;
        this.previews = previews;
        this.bulkPreview = bulkPreview;
        this.bulkLinks = bulkLinks;
        this.publicRecords = publicRecords;
    }

    @GetMapping("/configuration")
    public CongressImportService.Configuration configuration() { return imports.configuration(); }

    @GetMapping("/previews/{jobId}/records")
    public List<JsonNode> previewList(@PathVariable UUID jobId, @RequestParam(defaultValue = "BILL") String kind,
            @RequestParam(defaultValue = "") String search, @RequestParam(required = false) String personId,
            @RequestParam(required = false) String change,
            @RequestParam(defaultValue = "50") int limit, @RequestParam(defaultValue = "0") int offset) {
        return previews.list(jobId, kind, search, personId, change, limit, offset);
    }

    @GetMapping("/previews/{jobId}/records/{id}")
    public JsonNode previewRecord(@PathVariable UUID jobId, @PathVariable String id) { return previews.get(jobId, id); }

    @PostMapping("/imports")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public CongressImportService.Job start(@Valid @RequestBody CongressImportService.ImportRequest request) {
        return imports.start(request);
    }

    @GetMapping("/imports/{jobId}")
    public CongressImportService.Job status(@PathVariable UUID jobId) { return imports.status(jobId); }

    @GetMapping("/records")
    public List<JsonNode> list(@RequestParam(defaultValue = "BILL") String kind,
                              @RequestParam(defaultValue = "") String search, @RequestParam(required = false) String personId,
                              @RequestParam(defaultValue = "50") int limit, @RequestParam(defaultValue = "0") int offset) {
        return store.list(kind, search, personId, limit, offset);
    }

    @GetMapping("/politicians/{id}")
    public JsonNode linkedPerson(@PathVariable UUID id) { return store.linkedPerson(id); }

    @GetMapping("/politicians/{id}/drafts")
    public List<com.politikapp.backend.politician.entity.TimelineEntry> drafts(@PathVariable UUID id) {
        return profiles.drafts(id);
    }

    @GetMapping("/politicians/{id}/pending-source-updates")
    public List<CongressPublicService.SourceRecord> pendingSourceUpdates(@PathVariable UUID id) {
        return publicRecords.pending(id);
    }

    @PostMapping("/politicians/{id}/approve-source-updates")
    public CongressPublicService.ApprovalResult approveSourceUpdates(@PathVariable UUID id,
            @Valid @RequestBody ApproveSourceUpdatesRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.politikapp.backend.auth.security.AuthPrincipal principal) {
        if (principal == null) throw new com.politikapp.backend.common.HttpResponseException(401, "Authentication required.");
        return publicRecords.approve(id, request.keys(), principal.getUserId());
    }

    @GetMapping("/match-candidates")
    public List<CongressProfileService.MatchCandidate> matchCandidates() { return profiles.matchCandidates(); }

    @GetMapping("/bulk-link-preview")
    public CongressBulkLinkPreview.Preview bulkLinkPreview() { return bulkPreview.preview(); }

    @PostMapping("/bulk-links")
    public CongressBulkLinkService.Result bulkLink(@Valid @RequestBody List<CongressBulkLinkService.Link> approved) {
        return bulkLinks.link(approved);
    }

    @GetMapping("/records/{id}")
    public JsonNode get(@PathVariable String id) { return store.get(id); }

    @GetMapping("/records/{id}/revisions")
    public List<JsonNode> revisions(@PathVariable String id, @RequestParam(defaultValue = "20") int limit,
                                    @RequestParam(defaultValue = "0") int offset) {
        return store.revisions(id, limit, offset);
    }

    @PostMapping("/people/{id}/link")
    public Map<String, UUID> link(@PathVariable String id, @Valid @RequestBody LinkRequest request) {
        return Map.of("politicianId", profiles.link(id, request.politicianId(), request.evidenceUrl(), request.verificationNotes()));
    }

    @PostMapping("/people/{id}/politician")
    public Map<String, UUID> create(@PathVariable String id, @Valid @RequestBody CreatePoliticianRequest request) {
        return Map.of("politicianId", profiles.create(id, request));
    }

    @PostMapping("/bills/{id}/timeline-draft")
    public Map<String, UUID> draft(@PathVariable String id, @Valid @RequestBody DraftRequest request) {
        return Map.of("timelineId", profiles.draftBill(id, request.personId()));
    }

    @PostMapping("/people/{id}/memberships/{index}/timeline-draft")
    public Map<String, UUID> draftMembership(@PathVariable String id, @PathVariable int index) {
        return Map.of("timelineId", profiles.draftMembership(id, index));
    }

    @PostMapping("/drafts/{id}/publish")
    public com.politikapp.backend.politician.entity.TimelineEntry publishDraft(@PathVariable UUID id,
            @Valid @RequestBody PublishDraftRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.politikapp.backend.auth.security.AuthPrincipal principal) {
        if (principal == null) throw new com.politikapp.backend.common.HttpResponseException(401, "Authentication required.");
        return profiles.publishDraft(id, request.sourceUrl(), request.verificationNotes(),
                request.verifiedStatus(), request.summary(), principal.getUserId());
    }

    @PutMapping("/records/{id}/verification")
    public com.politikapp.backend.politician.entity.TimelineEntry updatePublished(@PathVariable UUID id,
            @Valid @RequestBody PublishDraftRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.politikapp.backend.auth.security.AuthPrincipal principal) {
        if (principal == null) throw new com.politikapp.backend.common.HttpResponseException(401, "Authentication required.");
        return profiles.updatePublished(id, request.sourceUrl(), request.verificationNotes(),
                request.verifiedStatus(), request.summary(), principal.getUserId());
    }
}
