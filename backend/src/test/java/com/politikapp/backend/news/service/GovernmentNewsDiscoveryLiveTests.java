package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Optional, read-only checks against public government sites. */
class GovernmentNewsDiscoveryLiveTests {
    private final ApprovedSourceClient client = new ApprovedSourceClient("www.dbm.gov.ph");
    private final SourceTextExtractor extractor = new SourceTextExtractor();
    private final GovernmentNewsRetrievalService service = new GovernmentNewsRetrievalService(
            mock(GovernmentSourceRepository.class), mock(NewsArticleRepository.class),
            mock(NewsAiService.class), client, extractor, new ObjectMapper());

    @Test
    @EnabledIfSystemProperty(named = "live.government.news", matches = "true")
    void discoversAndExtractsRecentDbmArticle() throws Exception {
        GovernmentSource source = source("https://www.dbm.gov.ph/",
                "https://www.dbm.gov.ph/index.php/management-2?format=feed&type=rss", "RSS");
        var candidates = service.candidates(source);
        assertTrue(candidates.size() >= 1);
        var first = candidates.stream().filter(candidate -> new PoliticalNewsRelevance().relevant(candidate.title()))
                .findFirst().orElseThrow(() -> new AssertionError("No relevant article in the current DBM feed."));
        assertTrue(first.url().startsWith("https://www.dbm.gov.ph/index.php/"));
        assertTrue(new PoliticalNewsRelevance().relevant(first.title()));
        assertNotNull(first.publishedAt());
        var article = extractor.extract(client.get(source, URI.create(first.url())));
        assertTrue(article.text().length() > 300);
        assertEquals(first.title(), article.title());
        assertNotNull(article.publishedAt());
    }

    @Test
    @EnabledIfSystemProperty(named = "live.government.ai", matches = "true")
    void configuredProviderSummarizesActualSourceWithoutDatabaseWrites() throws Exception {
        var settings = new java.util.Properties();
        var config = java.nio.file.Path.of(".env");
        if (java.nio.file.Files.exists(config)) {
            try (var reader = java.nio.file.Files.newBufferedReader(config, java.nio.charset.StandardCharsets.UTF_8)) {
                settings.load(reader);
            }
        }
        String key = System.getenv().getOrDefault("GEMINI_API_KEY", settings.getProperty("GEMINI_API_KEY", ""));
        String model = System.getenv().getOrDefault("GEMINI_MODEL", settings.getProperty("GEMINI_MODEL", ""));
        assertFalse(key.isBlank(), "Provider credentials are required for this explicit live test.");
        assertFalse(model.isBlank(), "Provider model configuration is required for this explicit live test.");
        assertFalse(unquote(model).startsWith("gemini-1.5"), "The live test process still sees a legacy model selection; update its effective provider configuration.");
        var source = source("https://www.dbm.gov.ph/",
                "https://www.dbm.gov.ph/index.php/management-2?format=feed&type=rss", "RSS");
        source.setName("Department of Budget and Management");
        var selected = service.candidates(source).stream()
                .filter(candidate -> new PoliticalNewsRelevance().relevant(candidate.title())).findFirst()
                .orElseThrow(() -> new AssertionError("No relevant source article available."));
        var text = extractor.extract(client.get(source, URI.create(selected.url())));
        assertTrue(text.text().length() >= 150, "Source body is insufficient for live AI testing.");
        var article = new com.politikapp.backend.news.entity.NewsArticle();
        article.setSource(source);
        article.setOriginalTitle(text.title());
        article.setOriginalContent(text.text());
        article.setSourceUrl(selected.url());
        article.setOriginalPublishedAt(selected.publishedAt());
        var ai = new NewsAiService(new ObjectMapper(), mock(com.politikapp.backend.politician.repository.PoliticianRepository.class));
        // Avoid reflection helpers that log field values: credentials must never enter test logs/properties.
        setPrivate(ai, "aiEnabled", true);
        setPrivate(ai, "mockMode", false);
        setPrivate(ai, "apiKey", unquote(key));
        setPrivate(ai, "model", unquote(model));
        ai.processArticle(article);
        assertEquals("COMPLETED", article.getAiProcessingStatus(), article.getReviewNotes());
        assertEquals("PENDING_REVIEW", article.getStatus());
        assertNotNull(article.getExtractionData());
        assertNull(article.getPublishedAt());
    }

    private void setPrivate(Object target, String name, Object value) throws Exception {
        var field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    private String unquote(String value) {
        String trimmed = value.trim();
        if (trimmed.length() >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
                || (trimmed.startsWith("'") && trimmed.endsWith("'")))) return trimmed.substring(1, trimmed.length() - 1);
        return trimmed;
    }

    private GovernmentSource source(String base, String feed, String type) {
        var source = new GovernmentSource();
        source.setBaseUrl(base);
        source.setFeedUrl(feed);
        source.setRetrievalType(type);
        return source;
    }
}
