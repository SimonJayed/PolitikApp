package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.SQLException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only identity preview. No profile or imported record is changed here. */
@Service
public class CongressBulkLinkPreview {
    private static final String SENATE_ROSTER = "https://legacy.senate.gov.ph/senators/sen20th.asp";
    private final JdbcTemplate jdbc;

    public CongressBulkLinkPreview(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Row(UUID politicianId, String profileName, String position, String status,
                      String sourceId, String sourceName, String aliases, String senateKeys,
                      String memberships, long authoredBillCount, String datasetUrl,
                      String officialRosterUrl, List<String> evidence, List<String> alternatives) {}
    public record Preview(int totalProfiles, long ready, long alreadyLinked, long review,
                          long unmatched, List<Row> rows) {}
    private record Profile(UUID id, String name, String position, String status) {}
    private record Person(String id, String name, String first, String middle, String last,
                          List<String> aliases, List<String> keys, List<String> memberships,
                          String datasetUrl, UUID linkedId, long authoredBillCount) {}
    private record NameMatch(boolean first, boolean surnameExact, boolean surnamePartial,
                             boolean middleCompatible, boolean suffixCompatible, boolean aliasUsed) {
        boolean plausible() { return first && (surnameExact || surnamePartial) && suffixCompatible; }
        boolean strong() { return plausible() && middleCompatible && surnameExact; }
    }

    @Transactional(readOnly = true)
    public Preview preview() {
        return jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Preview>) CongressBulkLinkPreview::readOnlyPreview);
    }

    /** Also used by a standalone read-only audit, so it previews the exact same rules as the admin API. */
    public static Preview readOnlyPreview(Connection connection) throws SQLException {
        var json = new ObjectMapper();
        List<Profile> profiles = new ArrayList<>();
        try (var query = connection.prepareStatement("""
                select politician_id, full_name, position, status from public.politicians
                where status <> 'ARCHIVED' order by full_name
                """); var rows = query.executeQuery()) {
            while (rows.next()) profiles.add(new Profile(rows.getObject(1, UUID.class), rows.getString(2),
                    rows.getString(3), rows.getString(4)));
        }
        Map<String, Long> bills = new HashMap<>();
        try (var query = connection.prepareStatement("""
                select rel.target_id, count(distinct rel.entity_id) from public.open_congress_relationships rel
                join public.open_congress_entities bill on bill.id=rel.entity_id and bill.current_revision=rel.revision
                where rel.relationship='AUTHORED_BY' and bill.kind='BILL' and rel.target_id is not null
                group by rel.target_id
                """); var rows = query.executeQuery()) {
            while (rows.next()) bills.put(rows.getString(1), rows.getLong(2));
        }
        List<Person> people = new ArrayList<>();
        try (var query = connection.prepareStatement("""
                select e.id, r.title, r.payload::text, r.dataset_commit, r.dataset_path, e.politician_id
                from public.open_congress_entities e join public.open_congress_revisions r
                  on r.entity_id=e.id and r.revision=e.current_revision where e.kind='PERSON'
                """); var rows = query.executeQuery()) {
            while (rows.next()) {
                JsonNode payload;
                try { payload = json.readTree(rows.getString(3)); }
                catch (Exception error) { throw new SQLException("Invalid imported person payload for " + rows.getString(1), error); }
                List<String> memberships = new ArrayList<>();
                for (var membership : payload.path("memberships")) {
                    memberships.add(membership.path("subtype").asText("") + " " + membership.path("congress").asText(""));
                }
                String datasetUrl = "https://github.com/bettergovph/open-congress-data/blob/"
                        + rows.getString(4) + "/" + rows.getString(5);
                people.add(new Person(rows.getString(1), rows.getString(2), payload.path("first_name").asText(""),
                        payload.path("middle_name").asText(""), payload.path("last_name").asText(""),
                        strings(payload.path("aliases")), strings(payload.path("senate_website_keys")),
                        memberships, datasetUrl, rows.getObject(6, UUID.class), bills.getOrDefault(rows.getString(1), 0L)));
            }
        }
        List<Row> results = new ArrayList<>();
        for (Profile profile : profiles) {
            Person linked = people.stream().filter(person -> profile.id().equals(person.linkedId())).findFirst().orElse(null);
            if (linked != null) {
                results.add(row(profile, "ALREADY_LINKED", linked, List.of("Existing database link."), List.of()));
                continue;
            }
            var candidates = people.stream().filter(person -> match(profile.name(), person).plausible())
                    .sorted(Comparator.comparing((Person person) -> match(profile.name(), person).strong()).reversed()
                            .thenComparing(Person::name)).toList();
            var compatible = candidates.stream().filter(person -> compatible(profile, person)).toList();
            if (compatible.size() == 1) {
                Person person = compatible.get(0);
                NameMatch name = match(profile.name(), person);
                List<String> evidence = new ArrayList<>();
                evidence.add(name.aliasUsed() ? "Given name corroborated by imported alias." : "Given name matches imported legal name.");
                evidence.add(name.surnameExact() ? "Surname matches." : "Surname is partial; review required.");
                evidence.add(name.middleCompatible() ? "Middle name or initial is compatible." : "Middle name or initial differs.");
                evidence.add("Imported Senate membership includes the 20th Congress.");
                if (!person.keys().isEmpty()) evidence.add("Imported Senate website key: " + String.join(", ", person.keys()));
                if (person.linkedId() != null) evidence.add("Source person is already linked to another profile.");
                String status = name.strong() && !person.keys().isEmpty() && person.linkedId() == null
                        ? "READY" : "REVIEW";
                results.add(row(profile, status, person, evidence,
                        candidates.stream().filter(other -> !other.id().equals(person.id())).limit(3)
                                .map(other -> other.name() + " [" + other.id() + "]").toList()));
            } else if (!compatible.isEmpty() || !candidates.isEmpty()) {
                List<Person> options = compatible.isEmpty() ? candidates : compatible;
                results.add(row(profile, "REVIEW", options.get(0),
                        List.of(compatible.isEmpty() ? "Name candidate exists, but current office and congressional membership do not corroborate an automatic link."
                                : "Multiple compatible source people require manual review."),
                        options.stream().skip(1).limit(4).map(other -> other.name() + " [" + other.id() + "]").toList()));
            } else {
                results.add(row(profile, "UNMATCHED", null, List.of("No imported person passes the name and surname checks."), List.of()));
            }
        }
        Map<String, Long> readyPersonCounts = results.stream().filter(row -> "READY".equals(row.status()))
                .collect(Collectors.groupingBy(Row::sourceId, Collectors.counting()));
        results = results.stream().map(row -> "READY".equals(row.status()) && readyPersonCounts.get(row.sourceId()) > 1
                ? new Row(row.politicianId(), row.profileName(), row.position(), "REVIEW", row.sourceId(),
                        row.sourceName(), row.aliases(), row.senateKeys(), row.memberships(), row.authoredBillCount(),
                        row.datasetUrl(), row.officialRosterUrl(), List.of("One source person matches multiple profiles."), row.alternatives())
                : row).toList();
        return new Preview(results.size(), count(results, "READY"), count(results, "ALREADY_LINKED"),
                count(results, "REVIEW"), count(results, "UNMATCHED"), results);
    }

    private static long count(List<Row> rows, String status) {
        return rows.stream().filter(row -> status.equals(row.status())).count();
    }

    private static Row row(Profile profile, String status, Person person, List<String> evidence, List<String> alternatives) {
        return new Row(profile.id(), profile.name(), profile.position(), status,
                person == null ? null : person.id(), person == null ? null : person.name(),
                person == null ? "" : String.join(", ", person.aliases()),
                person == null ? "" : String.join(", ", person.keys()),
                person == null ? "" : String.join(", ", person.memberships()),
                person == null ? 0 : person.authoredBillCount(), person == null ? null : person.datasetUrl(),
                "READY".equals(status) ? SENATE_ROSTER : null, evidence, alternatives);
    }

    private static boolean compatible(Profile profile, Person person) {
        return "SENATOR".equalsIgnoreCase(profile.position()) && person.memberships().stream()
                .anyMatch(membership -> "senate 20".equalsIgnoreCase(membership));
    }

    private static NameMatch match(String profileName, Person person) {
        List<String> profile = tokens(profileName);
        List<String> first = tokens(person.first());
        List<String> surname = tokens(person.last());
        List<String> aliases = person.aliases().stream().flatMap(alias -> tokens(alias).stream()).toList();
        if (profile.isEmpty() || first.isEmpty() || surname.isEmpty()) return new NameMatch(false, false, false, false, false, false);
        String given = profile.get(0);
        boolean aliasUsed = !first.contains(given) && aliases.contains(given);
        boolean firstMatches = first.contains(given) || aliasUsed;
        List<String> body = new ArrayList<>(profile);
        String profileSuffix = suffix(body.get(body.size() - 1)) ? body.remove(body.size() - 1) : "";
        List<String> sourceName = tokens(person.name());
        String sourceSuffix = sourceName.isEmpty() || !suffix(sourceName.get(sourceName.size() - 1)) ? "" : sourceName.get(sourceName.size() - 1);
        boolean suffixCompatible = profileSuffix.isEmpty() || profileSuffix.equals(sourceSuffix);
        boolean surnameExact = endsWith(body, surname);
        boolean surnamePartial = !surnameExact && surname.size() > 1 && body.get(body.size() - 1).equals(surname.get(0));
        if (surnameExact) body = body.subList(0, body.size() - surname.size());
        else if (surnamePartial) body = body.subList(0, body.size() - 1);
        String middleInitial = tokens(person.middle()).stream().findFirst().orElse("");
        boolean middleCompatible = true;
        if (!middleInitial.isEmpty()) {
            for (String token : body) {
                if (token.length() == 1 && !token.equals(middleInitial.substring(0, 1))) middleCompatible = false;
            }
        }
        return new NameMatch(firstMatches, surnameExact, surnamePartial, middleCompatible, suffixCompatible, aliasUsed);
    }

    private static boolean endsWith(List<String> body, List<String> end) {
        if (body.size() < end.size()) return false;
        return body.subList(body.size() - end.size(), body.size()).equals(end);
    }

    private static boolean suffix(String token) { return Set.of("jr", "sr", "ii", "iii", "iv", "v").contains(token); }

    private static List<String> strings(JsonNode value) {
        if (!value.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        value.forEach(item -> { if (!item.asText("").isBlank()) result.add(item.asText()); });
        return result;
    }

    private static List<String> tokens(String value) {
        if (value == null) return List.of();
        String normalized = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        return normalized.isEmpty() ? List.of() : Arrays.asList(normalized.split(" +"));
    }
}
