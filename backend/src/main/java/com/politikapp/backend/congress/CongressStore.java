package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.common.HttpResponseException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class CongressStore {
    record BatchItem(CongressDatasetParser.Parsed data, CongressSnapshot.File file) {}
    record Existing(String id, String kind, String revision, Timestamp snapshotUpdatedAt) {}
    record BillKey(Integer congress, String subtype, String billNumber) {}
    record PreviewIndex(Map<String, Existing> entities, Map<BillKey, String> bills) {
        Map<String, String> currentRevisions() {
            Map<String, String> revisions = new HashMap<>();
            entities.forEach((id, value) -> { if (value.revision() != null) revisions.put(id, value.revision()); });
            return revisions;
        }
    }
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;

    public CongressStore(JdbcTemplate jdbc, ObjectMapper json, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.json = json;
        this.transaction = new TransactionTemplate(manager);
        transaction.setTimeout(30);
    }

    void requireSchema() {
        if (!schemaReady()) {
            throw new HttpResponseException(409, "Open Congress migration V25 must be reviewed and applied separately first.");
        }
    }

    boolean schemaReady() {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                select to_regclass('public.open_congress_entities') is not null
                   and to_regclass('public.open_congress_revisions') is not null
                   and to_regclass('public.open_congress_relationships') is not null
                """, Boolean.class));
    }

    Map<String, String> currentRevisions() {
        Map<String, String> result = new java.util.HashMap<>();
        jdbc.query("select id, current_revision from public.open_congress_entities where current_revision is not null",
                (org.springframework.jdbc.core.RowCallbackHandler) row -> result.put(row.getString(1), row.getString(2)));
        return result;
    }

    PreviewIndex previewIndex() {
        Map<String, Existing> entities = new HashMap<>();
        Map<BillKey, String> bills = new HashMap<>();
        jdbc.query("""
                select e.id, e.kind, e.current_revision, r.snapshot_updated_at,
                       r.congress, r.subtype, r.bill_number
                from public.open_congress_entities e left join public.open_congress_revisions r
                on r.entity_id=e.id and r.revision=e.current_revision
                """, (org.springframework.jdbc.core.RowCallbackHandler) row -> {
            String id = row.getString(1);
            String kind = row.getString(2);
            entities.put(id, new Existing(id, kind, row.getString(3), row.getTimestamp(4)));
            if ("BILL".equals(kind) && row.getString(7) != null) {
                bills.put(new BillKey((Integer) row.getObject(5), row.getString(6), row.getString(7)), id);
            }
        });
        return new PreviewIndex(entities, bills);
    }

    void createBatch(List<BatchItem> items, CongressSnapshot snapshot) {
        if (items.isEmpty()) return;
        transaction.executeWithoutResult(status -> {
            var entities = new ArrayList<Object[]>();
            var revisions = new ArrayList<Object[]>();
            var relationships = new ArrayList<Object[]>();
            var pointers = new ArrayList<Object[]>();
            for (var item : items) {
                var data = item.data();
                entities.add(new Object[] {data.id(), data.kind()});
                revisions.add(new Object[] {data.id(), data.revision(), data.title(), data.congress(),
                        data.subtype(), data.billNumber(), data.filedDate(), encode(data.payload()),
                        encode(data.urls()), encode(data.flags()), item.file().path(), snapshot.commit,
                        item.file().blob(), Timestamp.from(snapshot.updatedAt), data.sourceUpdatedAt()});
                for (var relation : data.relations()) {
                    relationships.add(new Object[] {data.id(), data.revision(), relation.type(), relation.key(),
                            relation.targetId(), encode(relation.details())});
                }
                pointers.add(new Object[] {data.revision(), data.id()});
            }
            int[] inserted = jdbc.batchUpdate(
                    "insert into public.open_congress_entities(id, kind) values (?, ?) on conflict do nothing", entities);
            for (int count : inserted) {
                if (count == 0) throw new HttpResponseException(409, "A source identity appeared during import; stop and preview again.");
            }
            jdbc.batchUpdate("""
                    insert into public.open_congress_revisions
                    (entity_id, revision, title, congress, subtype, bill_number, filed_date, payload, source_urls,
                     uncertainty_flags, dataset_path, dataset_commit, upstream_blob, snapshot_updated_at, source_updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb), cast(? as jsonb), ?, ?, ?, ?, ?)
                    """, revisions);
            if (!relationships.isEmpty()) jdbc.batchUpdate("""
                    insert into public.open_congress_relationships
                    (entity_id, revision, relationship, external_key, target_id, details)
                    values (?, ?, ?, ?, ?, cast(? as jsonb))
                    """, relationships);
            jdbc.batchUpdate("update public.open_congress_entities set current_revision=? where id=?", pointers);
        });
    }

    String assessPreview(CongressDatasetParser.Parsed data, CongressSnapshot snapshot, PreviewIndex index) {
        Existing existing = index.entities().get(data.id());
        if (existing != null) {
            if (!Objects.equals(existing.kind(), data.kind())) return "IDENTITY_CONFLICT";
            if (Objects.equals(existing.revision(), data.revision())) return "UNCHANGED";
            if (existing.snapshotUpdatedAt() != null && existing.snapshotUpdatedAt().toInstant().isAfter(snapshot.updatedAt)) return "OLDER_SNAPSHOT";
        }
        if ("BILL".equals(data.kind()) && data.billNumber() != null) {
            String other = index.bills().get(new BillKey(data.congress(), data.subtype(), data.billNumber()));
            if (other != null && !other.equals(data.id())) return "IDENTITY_CONFLICT";
        }
        return existing == null || existing.revision() == null ? "WOULD_CREATE" : "WOULD_UPDATE";
    }

    String save(CongressDatasetParser.Parsed data, CongressSnapshot.File file, CongressSnapshot snapshot,
                boolean dryRun, boolean allowUpdates) {
        if (dryRun) return assess(data, snapshot);
        return transaction.execute(status -> {
            // Serializes duplicate IDs and natural bill identities across backend instances.
            String key = "BILL".equals(data.kind()) && data.billNumber() != null
                    ? "bill:" + data.congress() + ":" + data.subtype() + ":" + data.billNumber() : data.id();
            jdbc.queryForList("select pg_advisory_xact_lock(hashtextextended(?, 0))", "open-congress:" + data.id());
            if (!key.equals(data.id())) jdbc.queryForList("select pg_advisory_xact_lock(hashtextextended(?, 0))", "open-congress:" + key);
            String assessment = assess(data, snapshot);
            if (assessment.equals("UNCHANGED") || assessment.equals("OLDER_SNAPSHOT") || assessment.equals("IDENTITY_CONFLICT")) return assessment;
            if (assessment.equals("WOULD_UPDATE") && !allowUpdates) return "UPDATE_REQUIRES_APPROVAL";
            jdbc.update("insert into public.open_congress_entities(id, kind) values (?, ?) on conflict do nothing", data.id(), data.kind());
            List<String> flags = new ArrayList<>(data.flags());
            List<CongressDatasetParser.Relation> relations = new ArrayList<>();
            for (var relation : data.relations()) {
                String target = relation.targetId();
                if (target != null && !Boolean.TRUE.equals(jdbc.queryForObject(
                        "select exists(select 1 from public.open_congress_entities where id=? and current_revision is not null)", Boolean.class, target))) {
                    // Do not freeze a transient import failure into an immutable revision.
                    // A rerun can retry this record after its dependency has imported successfully.
                    throw new HttpResponseException(409, "Referenced source entity has not imported successfully: " + target);
                }
                relations.add(new CongressDatasetParser.Relation(relation.type(), relation.key(), target, relation.details()));
            }
            jdbc.update("""
                    insert into public.open_congress_revisions
                    (entity_id, revision, title, congress, subtype, bill_number, filed_date, payload, source_urls,
                     uncertainty_flags, dataset_path, dataset_commit, upstream_blob, snapshot_updated_at, source_updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb), cast(? as jsonb), ?, ?, ?, ?, ?)
                    on conflict (entity_id, revision) do nothing
                    """, data.id(), data.revision(), data.title(), data.congress(), data.subtype(), data.billNumber(),
                    data.filedDate(), encode(data.payload()), encode(data.urls()), encode(flags), file.path(), snapshot.commit,
                    file.blob(), Timestamp.from(snapshot.updatedAt), data.sourceUpdatedAt());
            for (var relation : relations) {
                jdbc.update("""
                        insert into public.open_congress_relationships(entity_id, revision, relationship, external_key, target_id, details)
                        values (?, ?, ?, ?, ?, cast(? as jsonb)) on conflict do nothing
                        """, data.id(), data.revision(), relation.type(), relation.key(), relation.targetId(), encode(relation.details()));
            }
            jdbc.update("update public.open_congress_entities set current_revision=? where id=?", data.revision(), data.id());
            return assessment.equals("WOULD_CREATE") ? "CREATED" : "UPDATED";
        });
    }

    private String assess(CongressDatasetParser.Parsed data, CongressSnapshot snapshot) {
        List<Map<String, Object>> existing = jdbc.queryForList("""
                select e.kind, e.current_revision, r.snapshot_updated_at
                from public.open_congress_entities e left join public.open_congress_revisions r
                on r.entity_id=e.id and r.revision=e.current_revision where e.id=?
                """, data.id());
        if (!existing.isEmpty()) {
            var row = existing.get(0);
            if (!Objects.equals(row.get("kind"), data.kind())) return "IDENTITY_CONFLICT";
            if (Objects.equals(row.get("current_revision"), data.revision())) return "UNCHANGED";
            if (row.get("snapshot_updated_at") instanceof Timestamp time && time.toInstant().isAfter(snapshot.updatedAt)) return "OLDER_SNAPSHOT";
        }
        if ("BILL".equals(data.kind()) && data.billNumber() != null && Boolean.TRUE.equals(jdbc.queryForObject("""
                select exists(select 1 from public.open_congress_entities e join public.open_congress_revisions r
                on r.entity_id=e.id and r.revision=e.current_revision
                where e.kind='BILL' and e.id<>? and r.congress=? and r.subtype=? and r.bill_number=?)
                """, Boolean.class, data.id(), data.congress(), data.subtype(), data.billNumber()))) return "IDENTITY_CONFLICT";
        return existing.isEmpty() || existing.get(0).get("current_revision") == null ? "WOULD_CREATE" : "WOULD_UPDATE";
    }

    public List<JsonNode> list(String kind, String search, String personId, int limit, int offset) {
        requireSchema();
        if (!List.of("PERSON", "CONGRESS", "CHAMBER", "COMMITTEE", "BILL").contains(kind)) throw new HttpResponseException(400, "Invalid entity kind.");
        return jdbc.query("""
                select jsonb_build_object('id', e.id, 'kind', e.kind, 'politicianId', e.politician_id,
                'revision', r.revision, 'title', r.title, 'congress', r.congress, 'subtype', r.subtype,
                'billNumber', r.bill_number, 'filedDate', r.filed_date, 'uncertaintyFlags', r.uncertainty_flags,
                'datasetCommit', r.dataset_commit, 'snapshotUpdatedAt', r.snapshot_updated_at,
                'sourceUpdatedAt', r.source_updated_at, 'importedAt', r.imported_at)::text
                from public.open_congress_entities e join public.open_congress_revisions r
                on r.entity_id=e.id and r.revision=e.current_revision where e.kind=?
                and (coalesce(r.title,'') ilike ? or e.id ilike ?)
                and (? = '' or exists(select 1 from public.open_congress_relationships a
                     where a.entity_id=e.id and a.revision=e.current_revision and a.relationship='AUTHORED_BY' and a.target_id=?))
                order by e.id limit ? offset ?
                """, (rs, row) -> decode(rs.getString(1)), kind, "%" + search + "%", "%" + search + "%",
                personId == null ? "" : personId, personId == null ? "" : personId,
                Math.max(1, Math.min(limit, 100)), Math.max(0, Math.min(offset, 1_000_000)));
    }

    public List<Map<String, String>> unlinkedPeople() {
        requireSchema();
        return jdbc.query("""
                select e.id, r.title from public.open_congress_entities e
                join public.open_congress_revisions r on r.entity_id=e.id and r.revision=e.current_revision
                where e.kind='PERSON' and e.politician_id is null and r.title is not null
                order by r.title
                """, (rs, row) -> Map.of("id", rs.getString("id"), "name", rs.getString("title")));
    }

    public JsonNode get(String id) {
        requireSchema();
        var rows = jdbc.query("""
                select (to_jsonb(r) || jsonb_build_object('kind', e.kind, 'politicianId', e.politician_id,
                'datasetRepository', 'https://github.com/bettergovph/open-congress-data',
                'datasetUrl', 'https://github.com/bettergovph/open-congress-data/blob/' || r.dataset_commit || '/' || r.dataset_path,
                'relationships', coalesce((select jsonb_agg(to_jsonb(rel) || jsonb_build_object('target_title', tr.title))
                  from public.open_congress_relationships rel
                  left join public.open_congress_entities te on te.id=rel.target_id
                  left join public.open_congress_revisions tr on tr.entity_id=te.id and tr.revision=te.current_revision
                  where rel.entity_id=e.id and rel.revision=e.current_revision), '[]'::jsonb)))::text
                from public.open_congress_entities e join public.open_congress_revisions r
                on r.entity_id=e.id and r.revision=e.current_revision where e.id=?
                """, (rs, row) -> decode(rs.getString(1)), id);
        if (rows.isEmpty()) throw new HttpResponseException(404, "Imported Open Congress record not found.");
        return rows.get(0);
    }

    public JsonNode linkedPerson(java.util.UUID politicianId) {
        requireSchema();
        var ids = jdbc.queryForList("select id from public.open_congress_entities where politician_id=?", String.class, politicianId);
        return ids.isEmpty() ? json.getNodeFactory().nullNode() : get(ids.get(0));
    }

    public List<JsonNode> revisions(String id, int limit, int offset) {
        requireSchema();
        return jdbc.query("select to_jsonb(r)::text from public.open_congress_revisions r where entity_id=? order by imported_at desc, revision limit ? offset ?",
                (rs, row) -> decode(rs.getString(1)), id, Math.max(1, Math.min(limit, 100)), Math.max(0, Math.min(offset, 1_000_000)));
    }

    private String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (java.io.IOException e) { throw new IllegalArgumentException("Cannot encode dataset record.", e); }
    }
    private JsonNode decode(String value) {
        try { return json.readTree(value); }
        catch (java.io.IOException e) { throw new IllegalStateException("Cannot read stored dataset record.", e); }
    }
}
