package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.common.HttpResponseException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** An explicit population operation; source history never becomes curated KPI evidence. */
@Service
public class CongressPopulationService {
    public record Row(String personId, String name, UUID politicianId, String action, String reason) {}
    public record Report(String commit, boolean dryRun, int people, int created, int existingLinked,
                         int alreadyLinked, int skipped, long memberships, long billRelationships, List<Row> rows) {}
    private record Profile(UUID id, String name, String status) {}
    private record Person(String id, String name, JsonNode payload, UUID linked) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public CongressPopulationService(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }

    @Transactional(readOnly = true)
    public Report preview(String commit) { return plan(commit); }

    @Transactional
    public Report populate(String commit) {
        jdbc.execute("lock table public.politicians, public.open_congress_entities in share row exclusive mode");
        Report plan = plan(commit);
        var inserts = new ArrayList<Object[]>();
        var links = new ArrayList<Object[]>();
        for (Row row : plan.rows()) {
            if (row.action().equals("CREATE")) inserts.add(new Object[] { row.politicianId(), row.name() });
            if (row.action().equals("CREATE") || row.action().equals("LINK_EXISTING")) {
                links.add(new Object[] { row.politicianId(), row.personId() });
            }
        }
        if (!inserts.isEmpty()) jdbc.batchUpdate("""
                insert into public.politicians(politician_id,full_name,status,profile_origin,created_at,updated_at)
                values (?,?,'INACTIVE','CONGRESS_DATASET',now(),now())
                """, inserts);
        if (!links.isEmpty()) jdbc.batchUpdate("""
                update public.open_congress_entities set politician_id=?,linked_at=now()
                where id=? and kind='PERSON' and politician_id is null
                """, links);
        // This explicit synchronization authorizes display of this commit's newly imported
        // history. Preserve the usual frozen-source behavior for unrelated future revisions.
        var latestImport=jdbc.queryForObject("select max(imported_at) from public.open_congress_revisions where dataset_commit=?",
                java.sql.Timestamp.class,commit);
        if (latestImport!=null) jdbc.update("""
                update public.open_congress_entities set linked_at=?
                where kind='PERSON' and politician_id is not null and (linked_at is null or linked_at<?)
                """, latestImport,latestImport);
        Report result = new Report(commit, false, plan.people(), plan.created(), plan.existingLinked(),
                plan.alreadyLinked(), plan.skipped(), plan.memberships(), plan.billRelationships(), plan.rows());
        try {
            jdbc.update("insert into public.open_congress_population_runs(id,dataset_commit,report) values (?,?,cast(? as jsonb))",
                    UUID.randomUUID(), commit, json.writeValueAsString(result));
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) { throw new IllegalStateException(error); }
        return result;
    }

    private Report plan(String commit) {
        if (commit == null || !commit.matches("[0-9a-f]{40}")) throw new HttpResponseException(400, "A full dataset commit is required.");
        var people = jdbc.query("""
                select e.id,r.title,r.payload::text,e.politician_id,r.dataset_commit
                from public.open_congress_entities e join public.open_congress_revisions r
                on r.entity_id=e.id and r.revision=e.current_revision where e.kind='PERSON' order by e.id
                """, (rs, index) -> {
            if (!commit.equals(rs.getString(5))) throw new HttpResponseException(409, "Person snapshots differ from the requested commit.");
            try { return new Person(rs.getString(1), rs.getString(2), json.readTree(rs.getString(3)), rs.getObject(4, UUID.class)); }
            catch (com.fasterxml.jackson.core.JsonProcessingException error) { throw new IllegalStateException(error); }
        });
        var profiles = jdbc.query("select politician_id,full_name,status from public.politicians order by politician_id",
                (rs, i) -> new Profile(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)));
        var claimed = people.stream().filter(p -> p.linked()!=null).collect(Collectors.toMap(Person::linked, Person::id));
        var names = people.stream().collect(Collectors.groupingBy(p -> normalize(p.name()), Collectors.counting()));
        var proposals = new HashMap<UUID,Integer>();
        for (Person p : people) if (p.linked()==null) for (Profile candidate : profiles) {
            if (matches(candidate.name(),p.name(),p.payload())) proposals.merge(candidate.id(),1,Integer::sum);
        }
        var rows = new ArrayList<Row>();
        int created=0, linked=0, already=0, skipped=0;
        for (Person person : people) {
            UUID id = person.linked();
            String action, reason;
            if (id != null) {
                action="ALREADY_LINKED"; reason="Existing source identity retained."; already++;
            } else if (person.name()==null || person.name().isBlank() || person.name().length()>150
                    || person.payload().path("first_name").asText("").isBlank()
                    || person.payload().path("last_name").asText("").isBlank()) {
                action="SKIP"; reason="Insufficient identifying name."; skipped++;
            } else if (names.get(normalize(person.name()))>1) {
                action="SKIP"; reason="Multiple source identities have the same normalized full name."; skipped++;
            } else {
                var candidates=profiles.stream().filter(p -> matches(p.name(), person.name(), person.payload())).toList();
                if (candidates.size()>1 || (candidates.size()==1 && (proposals.getOrDefault(candidates.get(0).id(),0)>1
                        || claimed.containsKey(candidates.get(0).id())
                        || "ARCHIVED".equals(candidates.get(0).status())))) {
                    action="SKIP"; reason="Ambiguous, archived, or already claimed existing identity."; skipped++;
                } else if (candidates.size()==1) {
                    id=candidates.get(0).id(); claimed.put(id,person.id());
                    action="LINK_EXISTING"; reason="Unique normalized legal name or documented alias and surname."; linked++;
                } else {
                    id=UUID.nameUUIDFromBytes(("open-congress:profile:"+person.id()).getBytes(StandardCharsets.UTF_8));
                    if (profiles.stream().anyMatch(p -> p.id().equals(UUID.nameUUIDFromBytes(
                            ("open-congress:profile:"+person.id()).getBytes(StandardCharsets.UTF_8))))) {
                        action="SKIP"; reason="Reserved profile identifier is already occupied."; skipped++;
                    } else { action="CREATE"; reason="Source-only profile; current office and personal term dates unverified."; created++; }
                }
            }
            rows.add(new Row(person.id(),person.name(),id,action,reason));
        }
        var eligibleIds=rows.stream().filter(row -> !"SKIP".equals(row.action())).map(Row::personId).toList();
        String placeholders=String.join(",",Collections.nCopies(eligibleIds.size(),"?"));
        long memberships = eligibleIds.isEmpty() ? 0 : jdbc.queryForObject("""
                select count(*) from public.open_congress_relationships rel join public.open_congress_entities e
                on e.id=rel.entity_id and e.current_revision=rel.revision
                where rel.relationship='MEMBER_OF' and e.kind='PERSON'
                """+" and e.id in ("+placeholders+")", Long.class,eligibleIds.toArray());
        long bills = eligibleIds.isEmpty() ? 0 : jdbc.queryForObject("""
                select count(*) from (select distinct rel.entity_id,rel.target_id
                from public.open_congress_relationships rel join public.open_congress_entities e
                on e.id=rel.entity_id and e.current_revision=rel.revision
                where rel.relationship='AUTHORED_BY' and rel.target_id is not null and e.kind='BILL'
                """+" and rel.target_id in ("+placeholders+")) relationships", Long.class,eligibleIds.toArray());
        return new Report(commit,true,people.size(),created,linked,already,skipped,memberships,bills,List.copyOf(rows));
    }

    static boolean matches(String profile, String sourceName, JsonNode payload) {
        String target=normalize(profile);
        if (target.equals(normalize(sourceName))) return true;
        String first=payload.path("first_name").asText("");
        String last=payload.path("last_name").asText("");
        String suffix=payload.path("name_suffix").asText("");
        if (target.equals(normalize(first+" "+last+" "+suffix))) return true;
        for (var alias : payload.path("aliases")) {
            if (target.equals(normalize(alias.asText()+" "+last+" "+suffix))) return true;
            // Hyphenated surnames may be represented by the first surname and a
            // documented nickname. Never discard middle names or suffixes otherwise.
            if (last.contains("-") && target.equals(normalize(alias.asText()+" "+last.split("-",2)[0]+" "+suffix))) return true;
        }
        return false;
    }

    private static String normalize(String name) {
        if (name==null) return "";
        return Normalizer.normalize(name.replaceAll("\"[^\"]*\"", " "),Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim().replaceAll("\\s+", " ");
    }
}
