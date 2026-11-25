package com.politikapp.backend.news.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.GovernmentSource;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.springframework.stereotype.Service;

@Service
public class OriginalArticleService {
    private static final long CACHE_MILLIS = Duration.ofMinutes(10).toMillis();
    private static final int CACHE_LIMIT = 64;
    private final NewsService news;
    private final ApprovedSourceClient client;
    private final SourceTextExtractor extractor;
    private final ObjectMapper json;
    private final Semaphore recoverySlots = new Semaphore(3);
    private final Map<UUID, CachedOriginal> cache = new LinkedHashMap<>(16, .75f, true);

    public OriginalArticleService(NewsService news, ApprovedSourceClient client, SourceTextExtractor extractor, ObjectMapper json) {
        this.news = news;
        this.client = client;
        this.extractor = extractor;
        this.json = json;
    }

    public OriginalView read(UUID id) {
        // Validate publication for every read, even when a restored layout is cached.
        StoredOriginal saved = news.originalSnapshot(id);
        String storedHtml = readStoredHtml(saved.metadata());
        if (storedHtml != null) return new OriginalView(storedHtml);
        if (saved.text() == null || saved.text().isBlank()) return new OriginalView(null);

        var previous = cached(id, saved);
        if (previous != null) return previous.view();
        if (!recoverySlots.tryAcquire()) return new OriginalView(null);
        try {
            var restored = new OriginalView(recover(saved));
            synchronized (cache) {
                cache.put(id, new CachedOriginal(saved, restored, System.currentTimeMillis() + CACHE_MILLIS));
                if (cache.size() > CACHE_LIMIT) cache.remove(cache.keySet().iterator().next());
            }
            return restored;
        } finally {
            recoverySlots.release();
        }
    }

    private CachedOriginal cached(UUID id, StoredOriginal saved) {
        synchronized (cache) {
            var hit = cache.get(id);
            return hit != null && hit.expiresAt() > System.currentTimeMillis() && hit.saved().equals(saved) ? hit : null;
        }
    }

    private String readStoredHtml(String metadata) {
        if (metadata == null) return null;
        try {
            var root = json.readTree(metadata);
            return root == null ? null : root.path("sourceMetadata").path("originalHtml").asText(null);
        } catch (JsonProcessingException failure) {
            return null;
        }
    }

    private String recover(StoredOriginal saved) {
        try {
            var source = new GovernmentSource();
            source.setBaseUrl(saved.baseUrl());
            var extracted = extractor.extract(client.get(source, URI.create(saved.url())));
            String text = normalized(saved.text());
            // Older stores sometimes included the publisher header and footer. Verify the complete
            // source-marked body appears intact before omitting the surrounding page chrome.
            String body = normalized(extracted.legacyText());
            boolean exactMatch = text.equals(body) || text.equals(normalized(extracted.text()));
            boolean wrappedBody = extracted.scopedBody() && !body.isBlank()
                    && (" " + text + " ").contains(" " + body + " ");
            return exactMatch || wrappedBody ? extracted.originalHtml() : null;
        } catch (IOException | IllegalArgumentException failure) {
            return null;
        }
    }

    private static String normalized(String text) {
        return text == null ? "" : text.replaceAll("[\\\\s\\\\p{Z}]+", " ").strip();
    }

    record StoredOriginal(String url, String baseUrl, String text, String metadata) {}
    record CachedOriginal(StoredOriginal saved, OriginalView view, long expiresAt) {}
    public record OriginalView(String html) {}
}
