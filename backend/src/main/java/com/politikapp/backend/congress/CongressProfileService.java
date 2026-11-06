package com.politikapp.backend.congress;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.dto.CreatePoliticianRequest;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.politician.service.PoliticianService;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Explicit administrator actions only: no fuzzy auto-merges or overwriting curated profiles. */
@Service
public class CongressProfileService {
    public record MatchCandidate(String sourceId, String sourceName, UUID politicianId,
                                 String politicianName, String position, String jurisdiction,
                                 String termStart, String termEnd) {}
    private final CongressStore store;
    private final JdbcTemplate jdbc;
    private final PoliticianRepository politicians;
    private final PoliticianService politicianService;
    private final TimelineEntryRepository timelines;

    public CongressProfileService(CongressStore store, JdbcTemplate jdbc, PoliticianRepository politicians,
                                  PoliticianService politicianService, TimelineEntryRepository timelines) {
        this.store = store;
        this.jdbc = jdbc;
        this.politicians = politicians;
        this.politicianService = politicianService;
        this.timelines = timelines;
    }

    public List<MatchCandidate> matchCandidates() {
        var profiles = politicians.findAllByOrderByFullNameAsc();
        var linked = new java.util.HashSet<>(jdbc.queryForList(
                "select politician_id from public.open_congress_entities where politician_id is not null", UUID.class));
        var sources = store.unlinkedPeople();
        var sourceNameCounts = new java.util.HashMap<String, Integer>();
        sources.forEach(source -> sourceNameCounts.merge(normalize(source.get("name")), 1, Integer::sum));
        return sources.stream().flatMap(source -> {
            if (sourceNameCounts.get(normalize(source.get("name"))) != 1) return java.util.stream.Stream.empty();
            var matches = profiles.stream().filter(profile -> !linked.contains(profile.getPoliticianId())
                    && normalize(profile.getFullName()).equals(normalize(source.get("name")))).toList();
            if (matches.size() != 1) return java.util.stream.Stream.empty();
            var profile = matches.get(0);
            if (!compatibleMembership(store.get(source.get("id")), profile.getPosition())) {
                return java.util.stream.Stream.empty();
            }
            return java.util.stream.Stream.of(new MatchCandidate(source.get("id"), source.get("name"),
                    profile.getPoliticianId(), profile.getFullName(), profile.getPosition(),
                    profile.getJurisdiction(), String.valueOf(profile.getTermStart()),
                    String.valueOf(profile.getTermEnd())));
        }).toList();
    }

    @Transactional
    public UUID link(String personId, UUID politicianId, String evidenceUrl, String verificationNotes) {
        lockPerson(personId);
        var profile = politicians.findById(politicianId)
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found."));
        validateOfficialEvidence(evidenceUrl, verificationNotes);
        UUID linked = attach(personId, politicianId);
        UUID evidenceId = UUID.nameUUIDFromBytes(("open-congress:identity:" + personId).getBytes(StandardCharsets.UTF_8));
        if (timelines.findById(evidenceId).isEmpty()) {
            TimelineEntry evidence = new TimelineEntry();
            evidence.setTimelineId(evidenceId);
            evidence.setPoliticianId(politicianId);
            evidence.setCategoryTag("SOURCE_VERIFICATION");
            evidence.setActionIdentifier("IDENTITY_LINK");
            evidence.setActionDetails(Map.of("openCongressPersonId", personId,
                    "sourceName", store.get(personId).path("title").asText("Unknown")));
            evidence.setSummary("Admin reviewed the Open Congress identity linked to " + profile.getFullName() + ".");
            evidence.setSourceUrl(evidenceUrl.trim());
            evidence.setVerificationNotes(verificationNotes.trim());
            evidence.setPublicationStatus("DRAFT");
            timelines.save(evidence);
        }
        return linked;
    }

    @Transactional
    public UUID create(String personId, CreatePoliticianRequest request) {
        lockPerson(personId);
        var person = store.get(personId);
        if (!person.path("politicianId").isNull()) return UUID.fromString(person.path("politicianId").asText());
        // Missing office/jurisdiction/personal term dates must be supplied and verified by an admin.
        // Congress session dates alone cannot establish an individual's exact term.
        String name = normalize(request.fullName());
        jdbc.queryForList("select pg_advisory_xact_lock(hashtextextended(?, 0))", "open-congress-person-name:" + name);
        if (politicians.findAllByOrderByFullNameAsc().stream().anyMatch(p -> normalize(p.getFullName()).equals(name))) {
            throw new HttpResponseException(409, "A politician with this name exists. Review and link the existing profile instead.");
        }
        UUID id = politicianService.createPolitician(request).politicianId();
        politicians.flush();
        return attach(personId, id);
    }

    @Transactional
    public UUID draftBill(String billId, String personId) {
        lockPerson(personId);
        var person = store.get(personId);
        var bill = store.get(billId);
        if (!"BILL".equals(bill.path("kind").asText())) throw new HttpResponseException(400, "Record is not a bill.");
        if (person.path("politicianId").isNull()) throw new HttpResponseException(409, "Link this source person to a politician first.");
        boolean authored = false;
        for (var relation : bill.path("relationships")) {
            if ("AUTHORED_BY".equals(relation.path("relationship").asText()) && personId.equals(relation.path("target_id").asText())) authored = true;
        }
        if (!authored) throw new HttpResponseException(409, "No resolved authorship relationship for this person and bill.");
        if (bill.path("source_urls").isEmpty()) throw new HttpResponseException(409, "A primary source URL is required before creating a timeline draft.");
        UUID politicianId = UUID.fromString(person.path("politicianId").asText());
        UUID timelineId = UUID.nameUUIDFromBytes(("open-congress:" + billId + ":" + personId).getBytes(StandardCharsets.UTF_8));
        var existing = timelines.findById(timelineId);
        if (existing.isPresent()) return timelineId; // Never overwrite a reviewed/published timeline.
        TimelineEntry timeline = new TimelineEntry();
        timeline.setTimelineId(timelineId);
        timeline.setPoliticianId(politicianId);
        timeline.setCategoryTag("LEGISLATION");
        timeline.setActionIdentifier("SPONSORED_LEGISLATION");
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("recordType", "BILL");
        details.put("legislationTitle", bill.path("title").asText("Untitled legislative record"));
        details.put("legislativeStatus", bill.path("filed_date").isNull() ? "UNKNOWN" : "FILED");
        details.put("openCongressId", billId);
        details.put("openCongressPersonId", personId);
        details.put("datasetCommit", bill.path("dataset_commit").asText());
        details.put("datasetRevision", bill.path("revision").asText());
        details.put("datasetUrl", bill.path("datasetUrl").asText());
        details.put("reportedStatus", bill.path("payload").path("status"));
        details.put("legislativeHistory", bill.path("payload").path("history"));
        details.put("uncertaintyFlags", bill.path("uncertainty_flags"));
        timeline.setActionDetails(details);
        timeline.setSummary("Dataset reports authorship of " + bill.path("title").asText(billId) + ". Primary-source verification required; enactment is not established.");
        timeline.setSourceUrl(bill.path("source_urls").get(0).asText());
        timeline.setVerificationNotes("Imported from BetterGovPH Open Congress. Review original documents, reported status and authorship before publication. Filing is not enactment.");
        timeline.setPublicationStatus("DRAFT");
        timelines.save(timeline);
        return timelineId;
    }

    @Transactional
    public UUID draftMembership(String personId, int index) {
        lockPerson(personId);
        var person = store.get(personId);
        if (person.path("politicianId").isNull()) throw new HttpResponseException(409, "Link this source person to a politician first.");
        var memberships = person.path("payload").path("memberships");
        if (!memberships.isArray() || index < 0 || index >= memberships.size()) {
            throw new HttpResponseException(404, "Membership record not found.");
        }
        var membership = memberships.get(index);
        String congress = membership.path("congress").asText("Unknown");
        String chamber = membership.path("subtype").asText("Unknown");
        String position = membership.path("position").asText("Not provided");
        UUID politicianId = UUID.fromString(person.path("politicianId").asText());
        String key = "open-congress:membership:" + personId + ":" + index + ":" + congress + ":" + chamber + ":" + position;
        UUID timelineId = UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
        if (timelines.findById(timelineId).isPresent()) return timelineId;
        TimelineEntry draft = new TimelineEntry();
        draft.setTimelineId(timelineId);
        draft.setPoliticianId(politicianId);
        draft.setCategoryTag("LEGISLATION");
        draft.setActionIdentifier("CONGRESSIONAL_MEMBERSHIP");
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("recordType", "MEMBERSHIP");
        details.put("openCongressId", personId);
        details.put("congress", congress);
        details.put("chamber", chamber);
        details.put("position", position);
        details.put("termStart", membership.path("start_date").asText("Unknown"));
        details.put("termEnd", membership.path("end_date").asText("Unknown"));
        details.put("datasetUrl", person.path("datasetUrl").asText(""));
        draft.setActionDetails(details);
        draft.setSummary("Source reports " + position + " membership in the " + chamber + " of Congress " + congress + ". Exact personal term dates require verification.");
        draft.setVerificationNotes("Source claim pending independent official verification.");
        draft.setPublicationStatus("DRAFT");
        return timelines.save(draft).getTimelineId();
    }

    @Transactional(readOnly = true)
    public List<TimelineEntry> drafts(UUID politicianId) {
        return timelines.findByPoliticianIdAndPublicationStatusAndIsHiddenFalseOrderByCreatedAtDesc(politicianId, "DRAFT")
                .stream().filter(entry -> entry.getActionDetails() != null
                        && entry.getActionDetails().containsKey("openCongressId")).toList();
    }

    @Transactional
    public TimelineEntry publishDraft(UUID timelineId, String sourceUrl, String notes, String verifiedStatus,
                                      String summary, UUID adminId) {
        TimelineEntry draft = timelines.findById(timelineId)
                .orElseThrow(() -> new HttpResponseException(404, "Congress draft not found."));
        if (!"DRAFT".equals(draft.getPublicationStatus()) || draft.getActionDetails() == null
                || !draft.getActionDetails().containsKey("openCongressId")) {
            throw new HttpResponseException(409, "Only an unpublished Congress draft can be verified.");
        }
        String personId = String.valueOf(draft.getActionDetails().getOrDefault("openCongressPersonId",
                draft.getActionDetails().get("openCongressId")));
        var person = store.get(personId);
        if (draft.getPoliticianId() == null || !draft.getPoliticianId().toString().equals(person.path("politicianId").asText())) {
            throw new HttpResponseException(409, "The source person is no longer linked to this politician.");
        }
        validateOfficialEvidence(sourceUrl, notes);
        if (verifiedStatus == null || verifiedStatus.isBlank()) {
            throw new HttpResponseException(400, "Describe the status supported by the official record.");
        }
        if (summary == null || summary.isBlank()) throw new HttpResponseException(400, "Reviewed summary is required.");
        Map<String, Object> details = new LinkedHashMap<>(draft.getActionDetails());
        details.put("verifiedStatus", verifiedStatus.trim());
        details.put("verifiedByAdminId", adminId.toString());
        details.put("verifiedAt", java.time.Instant.now().toString());
        draft.setActionDetails(details);
        draft.setSourceUrl(sourceUrl.trim());
        draft.setSummary(summary.trim());
        draft.setVerificationNotes(notes.trim());
        draft.setPublicationStatus("PUBLISHED");
        return timelines.save(draft);
    }

    @Transactional
    public TimelineEntry updatePublished(UUID timelineId, String sourceUrl, String notes,
                                         String verifiedStatus, String summary, UUID adminId) {
        TimelineEntry entry = timelines.findById(timelineId)
                .orElseThrow(() -> new HttpResponseException(404, "Congress record not found."));
        if (!"PUBLISHED".equals(entry.getPublicationStatus()) || entry.getActionDetails() == null
                || !entry.getActionDetails().containsKey("openCongressId") || entry.getIsHidden()) {
            throw new HttpResponseException(409, "Only a visible published Congress record can be edited here.");
        }
        validateOfficialEvidence(sourceUrl, notes);
        if (verifiedStatus == null || verifiedStatus.isBlank() || summary == null || summary.isBlank()) {
            throw new HttpResponseException(400, "Reviewed status and summary are required.");
        }
        Map<String, Object> details = new LinkedHashMap<>(entry.getActionDetails());
        details.put("verifiedStatus", verifiedStatus.trim());
        details.put("verifiedByAdminId", adminId.toString());
        details.put("verifiedAt", java.time.Instant.now().toString());
        entry.setActionDetails(details);
        entry.setSourceUrl(sourceUrl.trim());
        entry.setVerificationNotes(notes.trim());
        entry.setSummary(summary.trim());
        return timelines.save(entry);
    }

    private void lockPerson(String personId) {
        store.requireSchema();
        var rows = jdbc.queryForList("select id from public.open_congress_entities where id=? and kind='PERSON' for update", personId);
        if (rows.isEmpty()) throw new HttpResponseException(404, "Imported person not found.");
    }

    private UUID attach(String personId, UUID politicianId) {
        var person = store.get(personId);
        if (!person.path("politicianId").isNull()) {
            UUID linked = UUID.fromString(person.path("politicianId").asText());
            if (!linked.equals(politicianId)) throw new HttpResponseException(409, "This source profile is already linked; automatic relinking is prohibited.");
            return linked;
        }
        if (Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from public.open_congress_entities where politician_id=?)", Boolean.class, politicianId))) {
            throw new HttpResponseException(409, "Politician already linked to a different source identity.");
        }
        jdbc.update("update public.open_congress_entities set politician_id=?, linked_at=now() where id=?", politicianId, personId);
        return politicianId;
    }

    private static String normalize(String name) {
        return name == null ? "" : name.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }

    private static boolean compatibleMembership(com.fasterxml.jackson.databind.JsonNode person, String position) {
        String office = normalize(position);
        for (var membership : person.path("payload").path("memberships")) {
            String chamber = membership.path("subtype").asText("").toLowerCase(Locale.ROOT);
            if (("senate".equals(chamber) && office.contains("senator"))
                    || ("house".equals(chamber) && (office.contains("representative") || office.contains("congress")))) return true;
        }
        return false;
    }

    private static void validateOfficialEvidence(String url, String notes) {
        if (notes == null || notes.trim().length() < 20) {
            throw new HttpResponseException(400, "Explain the official evidence (at least 20 characters).");
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if ("https".equalsIgnoreCase(uri.getScheme()) && host != null
                    && host.toLowerCase(Locale.ROOT).endsWith(".gov.ph") && uri.getUserInfo() == null) return;
        } catch (RuntimeException ignored) { }
        throw new HttpResponseException(400, "Evidence must be an HTTPS Philippine government source URL.");
    }
}
