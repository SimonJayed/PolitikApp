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
                               String revision, JsonNode history, String reviewState, String billNumber,
                               String relationshipType, UUID authorPoliticianId, String originalSourceStatus) {
        public SourceRecord withSourceStatus(String status) {
            return new SourceRecord(key, type, title, congress, chamber, filedDate, reportedStatus, sourceUrl,
                    datasetUrl, revision, history, reviewState, billNumber, relationshipType, authorPoliticianId, status);
        }
    }
    public record Page(List<SourceRecord> records, int total, int offset, int limit, List<SourceRecord> memberships,
                       List<String> congresses) {}
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
        return publicRecords(politicianId, offset, limit, null);
    }

    @Transactional(readOnly = true)
    public Page publicRecords(UUID politicianId, int offset, int limit, Integer congress) {
        requireProfile(politicianId);
        Map<String, SourceRecord> visible = new LinkedHashMap<>();
        for (SourceRecord row : sourceRows(politicianId, false)) visible.put(row.key(), row);
        // An approved snapshot must still have an AUTHORED_BY relationship for
        // this exact politician and revision. Approval alone is not authorship.
        var authored = new java.util.HashSet<>(jdbc.queryForList("""
                select distinct 'bill:' || rel.entity_id || ':' || rel.revision
                from public.open_congress_relationships rel
                join public.open_congress_entities person on person.id=rel.target_id
                where person.kind='PERSON' and person.politician_id=? and rel.relationship='AUTHORED_BY'
                """, String.class, politicianId));
        for (TimelineEntry entry : approvedEntries(politicianId)) {
            SourceRecord row = fromEntry(entry);
            if (row != null && (!"BILL".equals(row.type()) || authored.contains(row.key() + ":" + row.revision()))) visible.put(row.key(), row);
        }
        var memberships = visible.values().stream().filter(row -> "MEMBERSHIP".equals(row.type())).toList();
        var bills = visible.values().stream().filter(row -> "BILL".equals(row.type())).toList();
        var congresses = bills.stream().map(SourceRecord::congress).filter(value -> congressNumber(value) > 0)
                .distinct().sorted(Comparator.comparing(CongressPublicService::congressNumber).reversed()).toList();
        List<SourceRecord> rows = new ArrayList<>(bills.stream()
                .filter(row -> congress == null || String.valueOf(congress).equals(row.congress())).toList());
        rows.sort(Comparator.comparing((SourceRecord row) -> congressNumber(row.congress()), Comparator.reverseOrder())
                .thenComparing(SourceRecord::title, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        int start = Math.min(Math.max(0, offset), rows.size());
        int size = Math.max(1, Math.min(50, limit));
        return new Page(rows.subList(start, Math.min(rows.size(), start + size)), rows.size(), start, size, memberships, congresses);
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
            details.put("billNumber", row.billNumber());
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
                json.valueToTree(d.get("history")), "ADMIN_REVIEWED_SOURCE", string(d.get("billNumber")),
                "BILL".equals(string(d.get("recordType"))) ? "AUTHORED_BY" : null, entry.getPoliticianId(), "UNCHECKED");
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
            String sourceUrl = governmentSource(urls);
            JsonNode memberships = payload.path("memberships");
            var membershipKeys = new java.util.HashSet<String>();
            for (int i = 0; i < memberships.size(); i++) {
                JsonNode m = memberships.get(i);
                if (!membershipKeys.add(m.path("type").asText()+":"+m.path("subtype").asText()+":"+m.path("congress").asText())) continue;
                String key = "membership:" + rs.getString(1) + ":" + i;
                rows.add(new SourceRecord(key, "MEMBERSHIP", "Congress " + m.path("congress").asText("Unknown") + " membership",
                        m.path("congress").asText("Unknown"), m.path("subtype").asText("Unknown"), null,
                        m.path("position").asText("Not provided"), sourceUrl,
                        datasetUrl(rs.getString(3), rs.getString(4)), rs.getString(2), json.createArrayNode(), "SOURCE_REPORTED", null,
                        null, null, "UNCHECKED"));
            }
        }, politicianId);
        String billsSql = """
                select distinct on (e.id) e.id, r.revision, r.title, r.congress::text, r.subtype,
                       r.filed_date::text, r.payload::text, r.source_urls::text, r.dataset_commit, r.dataset_path, r.bill_number, r.imported_at
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
            String url = governmentSource(urls);
            rows.add(new SourceRecord("bill:" + rs.getString(1), "BILL", rs.getString(3), rs.getString(4),
                    rs.getString(5), rs.getString(6), payload.path("status").isMissingNode() ? "Unknown" : payload.path("status").toString(),
                    url, datasetUrl(rs.getString(9), rs.getString(10)), rs.getString(2), payload.path("history"), "SOURCE_REPORTED", rs.getString(11),
                    "AUTHORED_BY", politicianId, "UNCHECKED"));
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

    private static String governmentSource(JsonNode urls) {
        if (urls.isArray()) for (JsonNode value : urls) {
            String url = value.asText(null);
            if (OriginalSourceService.sourceUri(url) != null) return url;
        }
        return null;
    }

    private static String string(Object value) { return value == null ? null : String.valueOf(value); }

    private static int congressNumber(String value) {
        try { return Integer.parseInt(value); } catch (Exception ignored) { return -1; }
    }
}
