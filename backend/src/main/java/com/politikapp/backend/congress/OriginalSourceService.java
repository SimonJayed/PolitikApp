package com.politikapp.backend.congress;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;

/** Bounded, read-only availability checks. Never rewrites stored source URLs. */
@Service
public class OriginalSourceService {
    private record Cached(long expiresAt, CompletableFuture<String> result) {}
    private final ConcurrentHashMap<String, Cached> cache = new ConcurrentHashMap<>();
    private final HttpClient client;
    private final Predicate<URI> networkTarget;

    public OriginalSourceService() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build(), OriginalSourceService::publicAddress);
    }

    OriginalSourceService(HttpClient client, Predicate<URI> networkTarget) {
        this.client = client;
        this.networkTarget = networkTarget;
    }

    public CongressPublicService.Page checkPage(CongressPublicService.Page page) {
        var requests = page.records().stream().map(row -> check(row.sourceUrl())
                .thenApply(row::withSourceStatus)).toList();
        CompletableFuture.allOf(requests.toArray(CompletableFuture[]::new)).join();
        return new CongressPublicService.Page(requests.stream().map(CompletableFuture::join).toList(),
                page.total(), page.offset(), page.limit(), page.memberships(), page.congresses());
    }

    CompletableFuture<String> check(String value) {
        URI uri = sourceUri(value);
        if (uri == null) return CompletableFuture.completedFuture("UNAVAILABLE");
        long now = System.currentTimeMillis();
        String key = uri.toASCIIString();
        cache.entrySet().removeIf(entry -> entry.getValue().expiresAt < now);
        if (cache.size() >= 512) cache.keySet().stream().findFirst().ifPresent(cache::remove);
        return cache.computeIfAbsent(key, ignored -> {
            var result = probe(uri, 0, false).orTimeout(12, java.util.concurrent.TimeUnit.SECONDS)
                    .exceptionally(error -> "UNCONFIRMED");
            // Availability is a recent observation, not a permanent assertion.
            return new Cached(now + 120_000, result);
        }).result;
    }

    private CompletableFuture<String> probe(URI uri, int redirects, boolean get) {
        return CompletableFuture.supplyAsync(() -> networkTarget.test(uri)).thenCompose(allowed -> {
            if (!allowed) return CompletableFuture.completedFuture("UNAVAILABLE");
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5))
                    .header("User-Agent", "PolitikApp-SourceCheck/1.0");
            if (get) request.header("Range", "bytes=0-0").GET();
            else request.method("HEAD", HttpRequest.BodyPublishers.noBody());
            return client.sendAsync(request.build(), HttpResponse.BodyHandlers.ofInputStream()).thenCompose(response -> {
                try (InputStream body = response.body()) { /* Close without downloading a document. */ }
                catch (Exception ignored) { /* Status and headers are still usable. */ }
                int status = response.statusCode();
                if (status >= 200 && status < 300) return CompletableFuture.completedFuture("AVAILABLE");
                if ((status == 405 || status == 501) && !get) return probe(uri, redirects, true);
                if (status >= 300 && status < 400 && redirects < 3) {
                    URI next;
                    try { next = sourceUri(uri.resolve(response.headers().firstValue("location").orElse("")).toString()); }
                    catch (RuntimeException error) { next = null; }
                    return next == null ? CompletableFuture.completedFuture("UNAVAILABLE") : probe(next, redirects + 1, get);
                }
                return CompletableFuture.completedFuture(status == 404 || status == 410 ? "UNAVAILABLE" : "UNCONFIRMED");
            });
        });
    }

    static URI sourceUri(String value) {
        try {
            if (value == null || value.isBlank() || value.length() > 4096) return null;
            // Encode literal spaces in historical paths without changing query separators or ! characters.
            URI uri = URI.create(value.trim().replace(" ", "%20"));
            String host = uri.getHost();
            if (host == null || uri.getUserInfo() != null) return null;
            int port = uri.getPort();
            if (port != -1 && !("https".equalsIgnoreCase(uri.getScheme()) && port == 443)
                    && !("http".equalsIgnoreCase(uri.getScheme()) && port == 80)) return null;
            host = host.toLowerCase(Locale.ROOT);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && (host.equals("gov.ph") || host.endsWith(".gov.ph")) ? uri : null;
        } catch (RuntimeException error) { return null; }
    }

    private static boolean publicAddress(URI uri) {
        try {
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()
                        || (address.getAddress().length == 16 && (address.getAddress()[0] & 0xfe) == 0xfc)) return false;
            }
            return true;
        } catch (Exception error) { return false; }
    }
}
