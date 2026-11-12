package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Compact public directory metadata; never loads every politician's bills. */
@Service
public class CongressDirectoryService {
    public record Membership(String chamber, int congress) {}
    public record Person(UUID politicianId, String lastName, String firstName, List<Membership> memberships) {}
    public record Directory(Integer currentCongress, LocalDate asOfDate, List<Person> people) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final Clock clock;

    @Autowired
    public CongressDirectoryService(JdbcTemplate jdbc, ObjectMapper json) {
        this(jdbc, json, Clock.system(ZoneId.of("Asia/Manila")));
    }

    CongressDirectoryService(JdbcTemplate jdbc, ObjectMapper json, Clock clock) {
        this.jdbc = jdbc;
        this.json = json;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Directory directory() {
        // Match public profile snapshots: latest person revision at identity linking,
        // not unreviewed current revisions. Congress dates identify the current period.
        var sourceRows = jdbc.queryForList("""
                select distinct on (e.id) e.kind, e.politician_id, r.payload::text as payload
                from public.open_congress_entities e
                join public.open_congress_revisions r on r.entity_id=e.id
                left join public.politicians p on p.politician_id=e.politician_id
                where (e.kind='CONGRESS' and r.revision=e.current_revision)
                   or (e.kind='PERSON' and p.status<>'ARCHIVED' and r.imported_at<=e.linked_at)
                order by e.id, r.imported_at desc
                """);
        // Published membership updates are public; private drafts/hidden entries are not.
        var reviewedRows = jdbc.queryForList("""
                select t.politician_id, t.action_details::text as payload
                from public.timeline_entries t
                join public.politicians p on p.politician_id=t.politician_id
                where t.publication_status='PUBLISHED' and not t.is_hidden and p.status<>'ARCHIVED'
                  and t.action_details->>'recordType'='MEMBERSHIP'
                """);
        return assemble(sourceRows, reviewedRows, LocalDate.now(clock));
    }

    Directory assemble(List<Map<String, Object>> sources, List<Map<String, Object>> reviewed, LocalDate today) {
        var people = new TreeMap<UUID, Person>();
        var memberships = new HashMap<UUID, Set<Membership>>();
        Integer current = null;
        LocalDate latestStart = null;
        for (var row : sources) {
            JsonNode payload = parse(row.get("payload"));
            if ("CONGRESS".equals(row.get("kind"))) {
                Integer number = number(payload.path("congress_number"));
                LocalDate start = date(payload.path("start_date"));
                LocalDate end = date(payload.path("end_date"));
                if (number != null && start != null && !today.isBefore(start)
                        && (end == null || !today.isAfter(end)) && (latestStart == null || start.isAfter(latestStart))) {
                    current = number; latestStart = start;
                }
                continue;
            }
            UUID id = UUID.fromString(row.get("politician_id").toString());
            people.put(id, new Person(id, text(payload.path("last_name")), text(payload.path("first_name")), List.of()));
            for (var member : payload.path("memberships")) {
                if ("chamber".equalsIgnoreCase(member.path("type").asText())) {
                    add(memberships, id, member.path("subtype").asText(), number(member.path("congress")));
                }
            }
        }
        for (var row : reviewed) {
            UUID id = UUID.fromString(row.get("politician_id").toString());
            JsonNode details = parse(row.get("payload"));
            add(memberships, id, details.path("chamber").asText(), number(details.path("congress")));
            people.putIfAbsent(id, new Person(id, null, null, List.of()));
        }
        var result = new ArrayList<Person>();
        people.forEach((id, person) -> result.add(new Person(id, person.lastName(), person.firstName(),
                memberships.getOrDefault(id, Set.of()).stream()
                        .sorted(Comparator.comparing(Membership::congress).reversed().thenComparing(Membership::chamber)).toList())));
        return new Directory(current, today, result);
    }

    private static void add(Map<UUID, Set<Membership>> target, UUID id, String chamber, Integer congress) {
        String normalized = chamber.trim().toLowerCase(Locale.ROOT);
        if (congress != null && (normalized.equals("senate") || normalized.equals("house"))) {
            target.computeIfAbsent(id, unused -> new HashSet<>()).add(new Membership(normalized, congress));
        }
    }

    private JsonNode parse(Object value) {
        try { return json.readTree(String.valueOf(value)); }
        catch (Exception error) { throw new IllegalStateException("Invalid public Congress directory metadata", error); }
    }
    private static Integer number(JsonNode value) {
        try { int number = Integer.parseInt(value.asText()); return number > 0 ? number : null; }
        catch (NumberFormatException ignored) { return null; }
    }
    private static LocalDate date(JsonNode value) {
        try { return LocalDate.parse(value.asText()); } catch (RuntimeException ignored) { return null; }
    }
    private static String text(JsonNode value) { return value.isTextual() && !value.asText().isBlank() ? value.asText().trim() : null; }
}
