package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Source-attributed public snapshots. The identity link time freezes the initial dataset. */
@Service
public class CongressPublicService {
    public record SourceRecord(String key, String type, String title, String congress, String chamber,
                               String filedDate, String reportedStatus, String sourceUrl, String datasetUrl,
                               String revision, JsonNode history, String reviewState) {}
    public record Page(List<SourceRecord> records, int total, int offset, int limit) {}
    public record ApprovalResult(int approved, int alreadyApproved) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final TimelineEntryRepository timelines;

    public CongressPublicService(JdbcTemplate jdbc, ObjectMapper json, TimelineEntryRepository timelines) {
        this.jdbc = jdbc;
        this.json = json;
        this.timelines = timelines;
    }

    @Transactional(readOnly = true)
    public Page publicRecords(UUID politicianId, int offset, int limit) {
        requireProfile(politicianId);
        Map<String, SourceRecord> visible = new LinkedHashMap<>();
        for (SourceRecord row : sourceRows(politicianId, false)) visible.put(row.key(), row);
        for (TimelineEntry entry : approvedEntries(politicianId)) {
            SourceRecord row = fromEntry(entry);
            if (row != null) visible.put(row.key(), row);
        }
        List<SourceRecord> rows = new ArrayList<>(visible.values());
        rows.sort(Comparator.comparing(SourceRecord::type).thenComparing(SourceRecord::congress,
                Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(SourceRecord::title));
        int start = Math.min(Math.max(0, offset), rows.size());
        int size = Math.max(1, Math.min(50, limit));
        return new Page(rows.subList(start, Math.min(rows.size(), start + size)), rows.size(), start, size);
    }

    @Transactional(readOnly = true)
    public List<SourceRecord> pending(UUID politicianId) {
        requireProfile(politicianId);
        Map<String, String> approved = new HashMap<>();
        for (TimelineEntry entry : approvedEntries(politicianId)) {
            Map<String, Object> details = entry.getActionDetails();
            approved.put(String.valueOf(details.get("sourceKey")), String.valueOf(details.get("sourceRevision")));
        }
        Map<String, String> baseline = new HashMap<>();
        for (SourceRecord row : sourceRows(politicianId, false)) baseline.put(row.key(), row.revision());
        return sourceRows(politicianId, true).stream()
                .filter(row -> !row.revision().equals(approved.getOrDefault(row.key(), baseline.get(row.key()))))
                .toList();
    }

    @Transactional
    public ApprovalResult approve(UUID politicianId, List<String> selectedKeys, UUID adminId) {
        requireProfile(politicianId);
        if (selectedKeys == null || selectedKeys.isEmpty() || selectedKeys.size() > 100) {
            throw new HttpResponseException(400, "Select between 1 and 100 source updates.");
        }
        Map<String, SourceRecord> available = new HashMap<>();
        for (SourceRecord row : pending(politicianId)) available.put(row.key(), row);
        int approved = 0;
        int already = 0;
        for (String key : selectedKeys.stream().distinct().toList()) {
            SourceRecord row = available.get(key);
            if (row == null) { already++; continue; }
            UUID timelineId = UUID.nameUUIDFromBytes(("open-congress:source:" + politicianId + ":" + key)
                    .getBytes(StandardCharsets.UTF_8));
            TimelineEntry entry = timelines.findById(timelineId).orElseGet(TimelineEntry::new);
            if (entry.getTimelineId() == null || !timelineId.equals(entry.getTimelineId())) entry.setTimelineId(timelineId);
            entry.setPoliticianId(politicianId);
            entry.setCategoryTag("LEGISLATION");
            entry.setActionIdentifier("MEMBERSHIP".equals(row.type()) ? "CONGRESSIONAL_MEMBERSHIP" : "SPONSORED_LEGISLATION");
            entry.setSummary("Open Congress dataset reports " + ("MEMBERSHIP".equals(row.type())
                    ? row.chamber() + " membership in Congress " + row.congress()
                    : "authorship of " + row.title()) + ". Source-reported; official status and enactment are not independently verified.");
            entry.setSourceUrl(row.sourceUrl());
            entry.setVerificationNotes("Admin approved display of the imported source revision. This is a source-reported claim, not independent official verification.");
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("sourceKey", row.key());
            details.put("sourceRevision", row.revision());
            details.put("sourceReported", true);
            details.put("reviewedByAdminId", adminId.toString());
            details.put("reviewedAt", java.time.Instant.now().toString());
            details.put("recordType", row.type());
            details.put("title", row.title());
            details.put("filedDate", row.filedDate());
            details.put("datasetUrl", row.datasetUrl());
            details.put("congress", row.congress());
            details.put("chamber", row.chamber());
            details.put("reportedStatus", row.reportedStatus());
            details.put("history", row.history());
            entry.setActionDetails(details);
            entry.setPublicationStatus("PUBLISHED");
            timelines.save(entry);
            approved++;
        }
        return new ApprovalResult(approved, already);
    }

    private List<TimelineEntry> approvedEntries(UUID politicianId) {
        return timelines.findActiveEntries(politicianId, "PUBLISHED").stream()
                .filter(entry -> entry.getActionDetails() != null && Boolean.TRUE.equals(entry.getActionDetails().get("sourceReported"))
                        && entry.getActionDetails().containsKey("sourceKey"))
                .toList();
    }

    private SourceRecord fromEntry(TimelineEntry entry) {
        Map<String, Object> d = entry.getActionDetails();
        if (d == null || d.get("sourceKey") == null) return null;
        return new SourceRecord(String.valueOf(d.get("sourceKey")), String.valueOf(d.get("recordType")),
                String.valueOf(d.getOrDefault("title", entry.getSummary())), string(d.get("congress")),
                string(d.get("chamber")), string(d.get("filedDate")), string(d.get("reportedStatus")),
                entry.getSourceUrl(), string(d.get("datasetUrl")), string(d.get("sourceRevision")),
                json.valueToTree(d.get("history")), "ADMIN_REVIEWED_SOURCE");
    }

    private List<SourceRecord> sourceRows(UUID politicianId, boolean current) {
        List<SourceRecord> rows = new ArrayList<>();
        // Memberships are claims from the linked person's snapshot; their personal dates may be absent.
        String peopleSql = """
                select person.id, r.revision, r.dataset_commit, r.dataset_path, r.payload::text, r.source_urls::text
                from public.open_congress_entities person
                join public.open_congress_revisions r on r.entity_id=person.id
                where person.kind='PERSON' and person.politician_id=? and %s
                order by r.imported_at desc limit 1
                """.formatted(current ? "r.revision=person.current_revision" : "r.imported_at<=person.linked_at");
        jdbc.query(peopleSql, rs -> {
            JsonNode payload = parse(rs.getString(5));
            JsonNode urls = parse(rs.getString(6));
            String sourceUrl = urls.isArray() && !urls.isEmpty() ? urls.get(0).asText(null) : null;
            JsonNode memberships = payload.path("memberships");
            for (int i = 0; i < memberships.size(); i++) {
                JsonNode m = memberships.get(i);
                String key = "membership:" + rs.getString(1) + ":" + i;
                rows.add(new SourceRecord(key, "MEMBERSHIP", "Congress " + m.path("congress").asText("Unknown") + " membership",
                        m.path("congress").asText("Unknown"), m.path("subtype").asText("Unknown"), null,
                        m.path("position").asText("Not provided"), sourceUrl,
                        datasetUrl(rs.getString(3), rs.getString(4)), rs.getString(2), json.createArrayNode(), "SOURCE_REPORTED"));
            }
        }, politicianId);
        String billsSql = """
                select distinct on (e.id) e.id, r.revision, r.title, r.congress::text, r.subtype,
                       r.filed_date::text, r.payload::text, r.source_urls::text, r.dataset_commit, r.dataset_path
                from public.open_congress_entities person
                join public.open_congress_relationships rel on rel.target_id=person.id and rel.relationship='AUTHORED_BY'
                join public.open_congress_entities e on e.id=rel.entity_id and e.kind='BILL'
                join public.open_congress_revisions r on r.entity_id=e.id and r.revision=rel.revision
                where person.kind='PERSON' and person.politician_id=? and %s
                order by e.id, r.imported_at desc
                """.formatted(current ? "r.revision=e.current_revision" : "r.imported_at<=person.linked_at");
        jdbc.query(billsSql, rs -> {
            JsonNode payload = parse(rs.getString(7));
            JsonNode urls = parse(rs.getString(8));
            String url = urls.isArray() && !urls.isEmpty() ? urls.get(0).asText(null) : null;
            rows.add(new SourceRecord("bill:" + rs.getString(1), "BILL", rs.getString(3), rs.getString(4),
                    rs.getString(5), rs.getString(6), payload.path("status").isMissingNode() ? "Unknown" : payload.path("status").toString(),
                    url, datasetUrl(rs.getString(9), rs.getString(10)), rs.getString(2), payload.path("history"), "SOURCE_REPORTED"));
        }, politicianId);
        return rows;
    }

    private void requireProfile(UUID id) {
        Boolean exists = jdbc.queryForObject("select exists(select 1 from public.politicians where politician_id=? and status<>'ARCHIVED')", Boolean.class, id);
        if (!Boolean.TRUE.equals(exists)) throw new HttpResponseException(404, "Politician profile not found.");
    }

    private JsonNode parse(String value) {
        try { return json.readTree(value); }
        catch (Exception error) { throw new IllegalStateException("Invalid imported Congress record", error); }
    }

    private static String datasetUrl(String commit, String path) {
        return "https://github.com/bettergovph/open-congress-data/blob/" + commit + "/" + path;
    }

    private static String string(Object value) { return value == null ? null : String.valueOf(value); }
}
