package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.politikapp.backend.common.HttpResponseException;
import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** In-memory index only. Details are loaded from immutable local Git blobs, never Supabase. */
@Service
public class CongressPreview {
    record Item(CongressSnapshot.File file, JsonNode summary, List<String> authors) {}
    record Index(UUID jobId, String commit, Instant updatedAt, CongressDatasetParser parser, Map<String, Item> items) {}
    private final ObjectMapper json;
    private final String checkout;
    private volatile Index index;

    public CongressPreview(ObjectMapper json, @Value("${app.open-congress.checkout:}") String checkout) {
        this.json = json;
        this.checkout = checkout;
    }

    Item item(CongressSnapshot.File file, CongressDatasetParser.Parsed record, String change) {
        ObjectNode summary = json.createObjectNode().put("id", record.id()).put("kind", record.kind())
                .put("title", record.title()).put("subtype", record.subtype()).put("billNumber", record.billNumber())
                .put("change", change);
        if (record.congress() != null) summary.put("congress", record.congress());
        summary.set("uncertaintyFlags", json.valueToTree(record.flags()));
        List<String> authors = record.relations().stream().filter(r -> "AUTHORED_BY".equals(r.type()) && r.targetId() != null)
                .map(CongressDatasetParser.Relation::targetId).distinct().toList();
        return new Item(file, summary, authors);
    }

    void complete(UUID jobId, CongressSnapshot snapshot, CongressDatasetParser parser, Map<String, Item> items) {
        index = new Index(jobId, snapshot.commit, snapshot.updatedAt, parser,
                java.util.Collections.unmodifiableMap(new LinkedHashMap<>(items)));
    }

    public List<JsonNode> list(UUID jobId, String kind, String search, String personId, String change, int limit, int offset) {
        Index current = require(jobId);
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return current.items().values().stream()
                .filter(item -> "ALL".equals(kind) || item.summary().path("kind").asText().equals(kind))
                .filter(item -> change == null || item.summary().path("change").asText().equals(change))
                .filter(item -> personId == null || item.authors().contains(personId))
                .filter(item -> term.isEmpty() || item.summary().path("title").asText("").toLowerCase(Locale.ROOT).contains(term)
                        || item.summary().path("id").asText().contains(term))
                .skip(Math.max(0, offset)).limit(Math.max(1, Math.min(limit, 100))).map(Item::summary).toList();
    }

    public JsonNode get(UUID jobId, String id) {
        Index current = require(jobId);
        Item item = current.items().get(id);
        if (item == null) throw new HttpResponseException(404, "Record is not in this preview.");
        try {
            var record = current.parser().parse(item.file(), CongressSnapshot.readBlob(checkout, item.file().blob()));
            ObjectNode detail = item.summary().deepCopy();
            detail.put("entity_id", id).put("revision", record.revision()).put("dataset_commit", current.commit())
                    .put("dataset_path", item.file().path()).put("snapshot_updated_at", current.updatedAt().toString())
                    .put("source_updated_at", record.sourceUpdatedAt()).putNull("politicianId").put("preview", true)
                    .put("datasetUrl", CongressSnapshot.REPOSITORY + "/blob/" + current.commit() + "/" + item.file().path());
            detail.set("payload", record.payload());
            detail.set("source_urls", json.valueToTree(record.urls()));
            detail.set("uncertainty_flags", json.valueToTree(record.flags()));
            var relations = detail.putArray("relationships");
            for (var relation : record.relations()) {
                var row = relations.addObject().put("relationship", relation.type()).put("external_key", relation.key())
                        .put("target_id", relation.targetId());
                Item target = current.items().get(relation.targetId());
                if (target != null) row.put("target_title", target.summary().path("title").asText());
                row.set("details", relation.details());
            }
            return detail;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new HttpResponseException(503, "Dataset preview was interrupted.");
        } catch (IOException e) {
            throw new HttpResponseException(422, "Cannot read this dataset record: " + e.getMessage());
        }
    }

    private Index require(UUID id) {
        Index current = index;
        if (current == null || !current.jobId().equals(id)) throw new HttpResponseException(409, "Run and finish a preview first. Preview records are retained until the next preview or restart.");
        return current;
    }
}
