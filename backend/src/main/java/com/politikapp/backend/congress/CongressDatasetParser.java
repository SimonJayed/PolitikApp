package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.toml.TomlMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Adapter for upstream TOML entities and YAML author-code mappings, not the hosted API. */
final class CongressDatasetParser {
    private static final String ADAPTER_VERSION = "open-congress-toml-v1:";
    record Relation(String type, String key, String targetId, JsonNode details) {}
    record Parsed(String id, String kind, String revision, String title, Integer congress, String subtype,
                  String billNumber, LocalDate filedDate, JsonNode payload, List<String> urls,
                  List<String> flags, String sourceUpdatedAt, List<Relation> relations) {}

    private final ObjectMapper toml = new TomlMapper();
    private final ObjectMapper yaml = new YAMLMapper();
    private final CongressSnapshot snapshot;
    private final JsonNode senate;
    private final JsonNode house;
    private final Set<String> people = new LinkedHashSet<>();
    private final Map<String, String> chambers = new LinkedHashMap<>();
    private final Set<String> ambiguousChambers = new LinkedHashSet<>();
    private final String dependencies;

    CongressDatasetParser(CongressSnapshot snapshot) throws IOException {
        this.snapshot = snapshot;
        senate = mapping("data/person/.senate-website-key-mapping.yml");
        house = mapping("data/person/.house-website-key-mapping.yml");
        StringBuilder dependencies = new StringBuilder();
        for (var file : snapshot.files.values()) {
            if (file.path().startsWith("data/person/") || file.path().startsWith("data/group/chamber/")) {
                dependencies.append(file.path()).append(':').append(file.blob()).append('\n');
            }
            if (file.path().matches("data/person/[A-Z0-9]+\\.toml")) people.add(fileId(file));
            if (file.path().matches("data/group/chamber/[A-Z0-9]+\\.toml")) {
                JsonNode node = toml.readTree(snapshot.read(file));
                String key = text(node, "congress") + ":" + text(node, "subtype").toLowerCase(Locale.ROOT);
                String id = text(node, "id");
                if (!id.equals(fileId(file))) throw new IOException("Chamber ID does not match filename: " + file.path());
                if (chambers.putIfAbsent(key, id) != null) ambiguousChambers.add(key);
            }
        }
        this.dependencies = hash(dependencies.toString());
    }

    static String kind(CongressSnapshot.File file) {
        String path = file.path();
        if (!path.endsWith(".toml") || path.substring(path.lastIndexOf('/') + 1).startsWith(".")) return null;
        if (path.startsWith("data/congress/")) return "CONGRESS";
        if (path.startsWith("data/group/chamber/")) return "CHAMBER";
        if (path.startsWith("data/committee/")) return "COMMITTEE";
        if (path.startsWith("data/person/")) return "PERSON";
        if (path.matches("data/document/(hb|sb)/[0-9]+/[^/]+\\.toml")) return "BILL";
        return null;
    }

    Parsed parse(CongressSnapshot.File file) throws IOException {
        return parse(file, snapshot.read(file));
    }

    Parsed parse(CongressSnapshot.File file, byte[] bytes) throws IOException {
        if (bytes.length > 8 * 1024 * 1024) throw new IOException("Dataset file exceeds 8 MiB limit.");
        JsonNode node = toml.readTree(bytes);
        String kind = kind(file);
        String id = text(node, "id");
        if (!id.matches("[A-Z0-9]{26}") || !id.equals(fileId(file))) throw new IOException("Invalid or mismatched dataset ID.");
        List<String> flags = new ArrayList<>();
        flags.add("COMMUNITY_DATASET_REQUIRES_PRIMARY_SOURCE_REVIEW");
        List<Relation> relations = new ArrayList<>();
        JsonNode meta = "BILL".equals(kind) ? node.path("meta") : node;
        Integer congress = integer(meta.path("CONGRESS".equals(kind) ? "congress_number" : "congress"));
        String subtype = nullable(text(node, "subtype").toLowerCase(Locale.ROOT));
        String title = first(text(meta, "title"), text(meta, "congress_website_title"), text(node, "name"));
        String billNumber = "BILL".equals(kind) ? nullable(text(meta, "bill_number")) : null;
        LocalDate filed = date(text(meta, "date_filed"), flags);
        if ("PERSON".equals(kind)) {
            title = first(text(node, "full_name"), String.join(" ", List.of(text(node, "first_name"),
                    text(node, "middle_name"), text(node, "last_name"), text(node, "name_suffix"))).replaceAll("\\s+", " ").trim());
            flags.add("PERSONAL_TERM_DATES_AND_JURISDICTION_NOT_VERIFIED");
            if (!node.path("memberships").isArray() || node.path("memberships").isEmpty()) flags.add("MEMBERSHIPS_MISSING");
            for (JsonNode membership : array(node.path("memberships"))) {
                String key = text(membership, "congress") + ":" + text(membership, "subtype").toLowerCase(Locale.ROOT);
                if (!"chamber".equals(text(membership, "type"))) { flags.add("UNSUPPORTED_MEMBERSHIP_TYPE"); continue; }
                String target = ambiguousChambers.contains(key) ? null : chambers.get(key);
                if (target == null) flags.add("UNRESOLVED_MEMBERSHIP:" + key);
                relations.add(new Relation("MEMBER_OF", key, target, membership));
            }
        } else if ("BILL".equals(kind)) {
            String[] path = file.path().split("/");
            if (!path[2].equals(subtype) || congress == null || !path[3].equals(congress.toString())) {
                throw new IOException("Bill path, chamber or Congress metadata disagree.");
            }
            if (billNumber == null) flags.add("BILL_NUMBER_MISSING");
            if (filed == null) flags.add("FILING_DATE_UNKNOWN");
            if (text(meta, "title").isBlank() && text(meta, "congress_website_title").isBlank()) flags.add("BILL_TITLE_MISSING");
            if (!node.hasNonNull("status") || node.path("status").isEmpty()) flags.add("STATUS_UNKNOWN");
            // Status and history remain verbatim in payload. Never derive enactment from filing/authorship.
            flags.add("ENACTMENT_NOT_INDEPENDENTLY_VERIFIED");
            addAuthors(meta.path("senate_website_author_codes"), "senate", congress, senate, relations, flags);
            addAuthors(meta.path("congress_website_author_codes"), "house", congress, house, relations, flags);
            if (relations.isEmpty()) flags.add("AUTHORSHIP_UNRESOLVED");
            if (meta.hasNonNull("congress_website_coauthors_raw")) flags.add("RAW_COAUTHORS_NOT_IDENTITY_MATCHED");
        }
        if (title == null || title.isBlank()) flags.add("NAME_OR_TITLE_MISSING");
        Set<String> urls = new LinkedHashSet<>();
        collectUrls(node, urls, flags);
        if (urls.isEmpty()) flags.add("PRIMARY_SOURCE_URL_MISSING");
        String updated = first(text(node, "updated_at"), text(meta, "updated_at"), text(meta, "last_updated"));
        if (updated == null) flags.add("SOURCE_UPDATE_DATE_UNKNOWN");
        List<Relation> resolvedRelations = unique(relations, flags);
        return new Parsed(id, kind, revision(file), title, congress, subtype, billNumber, filed, node,
                List.copyOf(urls), flags.stream().distinct().toList(), updated, resolvedRelations);
    }

    String revision(CongressSnapshot.File file) {
        return hash(ADAPTER_VERSION + file.blob() + (("PERSON".equals(kind(file)) || "BILL".equals(kind(file))) ? dependencies : ""));
    }

    private void addAuthors(JsonNode codes, String chamber, Integer congress, JsonNode mapping,
                            List<Relation> relations, List<String> flags) {
        for (JsonNode codeNode : array(codes)) {
            String code = codeNode.asText();
            boolean scoped = mapping.isObject() && mapping.elements().hasNext() && mapping.elements().next().isObject();
            JsonNode value = scoped ? mapping.path(String.valueOf(congress)).path(code) : mapping.path(code);
            String target = value.isTextual() ? value.asText() : null;
            if (!people.contains(target)) target = null;
            String key = chamber + ":" + congress + ":" + code;
            if (target == null) flags.add("UNRESOLVED_AUTHOR:" + key);
            String path = "data/person/." + chamber + "-website-key-mapping.yml";
            var mappingFile = snapshot.files.get(path);
            var details = toml.createObjectNode().put("authorCode", code).put("congressScoped", scoped)
                    .put("mappingPath", path).put("mappingCommit", snapshot.commit)
                    .put("mappingUrl", CongressSnapshot.REPOSITORY + "/blob/" + snapshot.commit + "/" + path);
            if (mappingFile != null) details.put("mappingBlob", mappingFile.blob());
            relations.add(new Relation("AUTHORED_BY", key, target, details));
        }
    }

    private JsonNode mapping(String path) throws IOException {
        var file = snapshot.files.get(path);
        if (file == null) return yaml.createObjectNode();
        JsonNode value = yaml.readTree(snapshot.read(file));
        if (value == null || !value.isObject()) throw new IOException("Invalid author mapping: " + path);
        return value;
    }

    private static List<Relation> unique(List<Relation> rows, List<String> flags) {
        Map<String, Relation> unique = new LinkedHashMap<>();
        for (Relation row : rows) {
            if (unique.putIfAbsent(row.type() + ":" + row.key(), row) != null) flags.add("DUPLICATE_RELATIONSHIP_IN_SOURCE");
        }
        return List.copyOf(unique.values());
    }

    private static void collectUrls(JsonNode node, Set<String> urls, List<String> flags) {
        if (node.isObject()) node.fields().forEachRemaining(field -> {
            String key = field.getKey().toLowerCase(Locale.ROOT);
            if (key.contains("url") || key.contains("permalink")) addUrls(field.getValue(), urls, flags);
            else if (field.getValue().isContainerNode()) collectUrls(field.getValue(), urls, flags);
        });
        else if (node.isArray()) node.forEach(child -> collectUrls(child, urls, flags));
    }

    private static void addUrls(JsonNode node, Set<String> urls, List<String> flags) {
        if (node.isArray()) { node.forEach(child -> addUrls(child, urls, flags)); return; }
        if (!node.isTextual()) return;
        try {
            URI uri = URI.create(node.asText());
            if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
            urls.add(uri.toString());
        } catch (IllegalArgumentException e) { flags.add("INVALID_SOURCE_URL_PRESERVED_IN_PAYLOAD"); }
    }

    static String fileId(CongressSnapshot.File file) {
        String name = file.path().substring(file.path().lastIndexOf('/') + 1);
        return name.substring(0, name.length() - 5);
    }
    static String text(JsonNode node, String key) { return node.path(key).isValueNode() ? node.path(key).asText("") : ""; }
    static Iterable<JsonNode> array(JsonNode node) { return node.isArray() ? node : List.of(); }
    static String nullable(String value) { return value == null || value.isBlank() ? null : value; }
    static String first(String... values) { for (String value : values) if (nullable(value) != null) return value; return null; }
    private static Integer integer(JsonNode node) {
        try { return node.isMissingNode() ? null : Integer.valueOf(node.asText()); }
        catch (NumberFormatException e) { return null; }
    }
    private static LocalDate date(String value, List<String> flags) {
        if (value.isBlank()) return null;
        try { return LocalDate.parse(value); }
        catch (java.time.format.DateTimeParseException e) { flags.add("INVALID_FILING_DATE:" + value); return null; }
    }
    static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
