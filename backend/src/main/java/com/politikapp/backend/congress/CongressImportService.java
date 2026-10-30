package com.politikapp.backend.congress;

import com.politikapp.backend.common.HttpResponseException;
import jakarta.annotation.PreDestroy;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CongressImportService {
    public record ImportRequest(@NotBlank @Pattern(regexp = "[0-9a-f]{40}") String commit,
                                Boolean dryRun, boolean allowUpdates, @Min(1) @Max(100) Integer congress,
                                UUID previewJobId) {
        boolean preview() { return dryRun == null || dryRun; }
    }
    public record Issue(String path, String reason) {}
    public record Job(UUID id, String state, String commit, boolean dryRun, Map<String, Integer> counts,
                      List<Issue> issues, Instant startedAt, Instant finishedAt, boolean comparedWithDatabase,
                      Integer congress, boolean allowUpdates) {}
    public record Configuration(boolean enabled, boolean importEnabled, boolean schemaReady, String commit, String message, Job lastJob) {}
    private final CongressStore store;
    private final CongressPreview previews;
    private final boolean enabled;
    private final boolean importEnabled;
    private final String checkout;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "open-congress-import");
        thread.setDaemon(true);
        return thread;
    });
    private volatile Job job;

    public CongressImportService(CongressStore store, CongressPreview previews,
            @Value("${app.open-congress.enabled:false}") boolean enabled,
            @Value("${app.open-congress.import-enabled:false}") boolean importEnabled,
            @Value("${app.open-congress.checkout:}") String checkout) {
        this.store = store;
        this.previews = previews;
        this.enabled = enabled;
        this.importEnabled = importEnabled;
        this.checkout = checkout;
    }

    public synchronized Job start(ImportRequest request) {
        if (!enabled) throw new HttpResponseException(409, "Open Congress import is disabled. Configure OPEN_CONGRESS_ENABLED and OPEN_CONGRESS_CHECKOUT.");
        if (job != null && "RUNNING".equals(job.state())) throw new HttpResponseException(409, "An Open Congress import is already running.");
        if (!request.preview() && !importEnabled) throw new HttpResponseException(409, "Database imports are disabled pending approval. Preview remains available.");
        boolean schemaReady = store.schemaReady();
        if (!request.preview()) {
            store.requireSchema();
            // Approval is bound to the exact completed preview, including its scope and update policy.
            // A direct API request must satisfy the same review gate as the admin interface.
            if (job == null || !job.dryRun() || !"COMPLETED".equals(job.state()) || !job.comparedWithDatabase()
                    || !job.id().equals(request.previewJobId()) || !job.commit().equals(request.commit())
                    || !java.util.Objects.equals(job.congress(), request.congress()) || job.allowUpdates() != request.allowUpdates()) {
                throw new HttpResponseException(409, "Finish a successful database-aware preview with the same commit, Congress and update approval, then submit its previewJobId.");
            }
        }
        Job reviewed = request.preview() ? null : job;
        Job initial = new Job(UUID.randomUUID(), "RUNNING", request.commit(), request.preview(), Map.of(), List.of(), Instant.now(), null, schemaReady, request.congress(), request.allowUpdates());
        job = initial;
        executor.submit(() -> run(initial, request, reviewed));
        return initial;
    }

    public Job status(UUID id) {
        Job current = job;
        if (current == null || !current.id().equals(id)) throw new HttpResponseException(404, "Import job not found; job status is retained until restart or the next import.");
        return current;
    }

    public Configuration configuration() {
        String commit = null;
        String message = null;
        try { commit = CongressSnapshot.head(checkout); }
        catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            message = "Dataset checkout is unavailable. Check the configured path and Git installation.";
        }
        return new Configuration(enabled, importEnabled, store.schemaReady(), commit, message, job);
    }

    private void run(Job initial, ImportRequest request, Job reviewed) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        List<Issue> issues = new ArrayList<>();
        String state = "COMPLETED";
        try (CongressSnapshot snapshot = new CongressSnapshot(checkout, request.commit())) {
            CongressDatasetParser parser = new CongressDatasetParser(snapshot);
            List<String> order = List.of("CONGRESS", "CHAMBER", "COMMITTEE", "PERSON", "BILL");
            var files = snapshot.files.values().stream().filter(file -> CongressDatasetParser.kind(file) != null)
                    .filter(file -> request.congress() == null || !"BILL".equals(CongressDatasetParser.kind(file))
                            || file.path().split("/")[3].equals(request.congress().toString()))
                    .sorted(Comparator.comparingInt((CongressSnapshot.File file) -> order.indexOf(CongressDatasetParser.kind(file)))
                            .thenComparing(CongressSnapshot.File::path)).toList();
            var ids = new HashSet<String>();
            for (var file : files) if (!ids.add(CongressDatasetParser.fileId(file))) throw new java.io.IOException("Duplicate upstream ID in snapshot.");
            counts.put("TOTAL", files.size());
            // The approved first import can insert records in transactional batches. A fresh
            // database comparison runs before any batch, and every dependency kind is committed
            // before its dependents. Existing revisions remain untouched on a resumed run.
            if (!request.preview() && reviewed != null && reviewed.counts().getOrDefault("TOTAL", 0) == files.size()
                    && reviewed.counts().getOrDefault("WOULD_CREATE", 0)
                        + reviewed.counts().getOrDefault("UNCHANGED", 0) == files.size()) {
                bulkCreate(initial, snapshot, parser, files, counts);
                return;
            }
            CongressStore.PreviewIndex previewIndex = initial.comparedWithDatabase() && request.preview() ? store.previewIndex() : null;
            Map<String, String> currentRevisions = previewIndex != null ? previewIndex.currentRevisions()
                    : initial.comparedWithDatabase() ? store.currentRevisions() : Map.of();
            Map<String, CongressPreview.Item> previewItems = new LinkedHashMap<>();
            for (var file : files) {
                if (Thread.currentThread().isInterrupted()) { state = "INTERRUPTED"; break; }
                try {
                    boolean unchanged = parser.revision(file).equals(currentRevisions.get(CongressDatasetParser.fileId(file)));
                    var parsed = unchanged && !request.preview() ? null : parser.parse(file);
                    String result = unchanged ? "UNCHANGED" : previewIndex != null
                            ? store.assessPreview(parsed, snapshot, previewIndex)
                            : initial.comparedWithDatabase()
                            ? store.save(parsed, file, snapshot, false, request.allowUpdates()) : "SOURCE_RECORD";
                    if (request.preview()) previewItems.put(parsed.id(), previews.item(file, parsed, result));
                    counts.merge(result, 1, Integer::sum);
                    counts.merge(CongressDatasetParser.kind(file), 1, Integer::sum);
                    if (parsed != null) {
                        counts.merge("AUTHORSHIPS", (int) parsed.relations().stream().filter(r -> r.type().equals("AUTHORED_BY")).count(), Integer::sum);
                        counts.merge("MEMBERSHIPS", (int) parsed.relations().stream().filter(r -> r.type().equals("MEMBER_OF")).count(), Integer::sum);
                        counts.merge("HISTORY_EVENTS", parsed.payload().path("history").size(), Integer::sum);
                    }
                    if (parsed != null && !parsed.flags().isEmpty()) counts.merge("FLAGGED", 1, Integer::sum);
                    if (List.of("IDENTITY_CONFLICT", "OLDER_SNAPSHOT", "UPDATE_REQUIRES_APPROVAL").contains(result)) {
                        if (issues.size() < 100) issues.add(new Issue(file.path(), result));
                    }
                } catch (Exception exception) {
                    counts.merge("FAILED", 1, Integer::sum);
                    if (issues.size() < 100) {
                        String message = exception instanceof java.io.IOException || exception instanceof HttpResponseException
                                ? exception.getMessage() : exception.getClass().getSimpleName();
                        if (message == null) message = "Invalid dataset record";
                        issues.add(new Issue(file.path(), message.substring(0, Math.min(message.length(), 400))));
                    }
                }
                counts.merge("PROCESSED", 1, Integer::sum);
                job = new Job(initial.id(), "RUNNING", snapshot.commit, request.preview(), Map.copyOf(counts), List.copyOf(issues), initial.startedAt(), null, initial.comparedWithDatabase(), request.congress(), request.allowUpdates());
            }
            if (state.equals("COMPLETED") && (counts.containsKey("FAILED") || counts.containsKey("IDENTITY_CONFLICT")
                    || counts.containsKey("OLDER_SNAPSHOT") || counts.containsKey("UPDATE_REQUIRES_APPROVAL"))) state = "COMPLETED_WITH_ISSUES";
            if (request.preview() && state.startsWith("COMPLETED")) previews.complete(initial.id(), snapshot, parser, previewItems);
        } catch (Exception exception) {
            state = "FAILED";
            if (issues.size() < 100) issues.add(new Issue("snapshot", exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage()));
        } finally {
            job = new Job(initial.id(), state, request.commit(), request.preview(), Map.copyOf(counts), List.copyOf(issues), initial.startedAt(), Instant.now(), initial.comparedWithDatabase(), request.congress(), request.allowUpdates());
        }
    }

    private void bulkCreate(Job initial, CongressSnapshot snapshot, CongressDatasetParser parser,
                            List<CongressSnapshot.File> files, Map<String, Integer> counts) throws java.io.IOException {
        CongressStore.PreviewIndex index = store.previewIndex();
        var billKeys = new HashSet<String>();
        var rows = new ArrayList<CongressStore.BatchItem>();
        for (var file : files) {
            var data = parser.parse(file);
            String assessment = store.assessPreview(data, snapshot, index);
            if (!List.of("WOULD_CREATE", "UNCHANGED").contains(assessment)) {
                throw new java.io.IOException("Source or database changed after preview at " + file.path() + ": " + assessment);
            }
            if ("BILL".equals(data.kind()) && data.billNumber() != null
                    && !billKeys.add(data.congress() + ":" + data.subtype() + ":" + data.billNumber())) {
                throw new java.io.IOException("Duplicate bill identity in dataset: " + file.path());
            }
            counts.merge(data.kind(), 1, Integer::sum);
            counts.merge("AUTHORSHIPS", (int) data.relations().stream().filter(r -> r.type().equals("AUTHORED_BY")).count(), Integer::sum);
            counts.merge("MEMBERSHIPS", (int) data.relations().stream().filter(r -> r.type().equals("MEMBER_OF")).count(), Integer::sum);
            counts.merge("HISTORY_EVENTS", data.payload().path("history").size(), Integer::sum);
            if (!data.flags().isEmpty()) counts.merge("FLAGGED", 1, Integer::sum);
            if ("UNCHANGED".equals(assessment)) counts.merge("UNCHANGED", 1, Integer::sum);
            else rows.add(new CongressStore.BatchItem(data, file));
        }
        counts.put("PROCESSED", counts.getOrDefault("UNCHANGED", 0));
        String currentKind = null;
        var batch = new ArrayList<CongressStore.BatchItem>(100);
        for (var row : rows) {
            if (Thread.currentThread().isInterrupted()) throw new java.io.IOException("Import interrupted; committed batches are retained.");
            if (!batch.isEmpty() && (!row.data().kind().equals(currentKind) || batch.size() == 100)) {
                saveBatch(initial, snapshot, batch, counts);
                batch.clear();
            }
            currentKind = row.data().kind();
            batch.add(row);
        }
        if (!batch.isEmpty()) saveBatch(initial, snapshot, batch, counts);
    }

    private void saveBatch(Job initial, CongressSnapshot snapshot, List<CongressStore.BatchItem> batch,
                           Map<String, Integer> counts) {
        store.createBatch(batch, snapshot);
        counts.merge("CREATED", batch.size(), Integer::sum);
        counts.merge("PROCESSED", batch.size(), Integer::sum);
        job = new Job(initial.id(), "RUNNING", snapshot.commit, false, Map.copyOf(counts), List.of(),
                initial.startedAt(), null, true, initial.congress(), initial.allowUpdates());
    }

    @PreDestroy public void close() { executor.shutdownNow(); }
}
