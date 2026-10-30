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
        var first = candidates.get(0);
        assertTrue(first.url().startsWith("https://www.dbm.gov.ph/index.php/"));
        assertTrue(new PoliticalNewsRelevance().relevant(first.title()));
        assertNotNull(first.publishedAt());
        var article = extractor.extract(client.get(source, URI.create(first.url())));
        assertTrue(article.text().length() > 300);
        assertEquals(first.title(), article.title());
        assertNotNull(article.publishedAt());
    }

    private GovernmentSource source(String base, String feed, String type) {
        var source = new GovernmentSource();
        source.setBaseUrl(base);
        source.setFeedUrl(feed);
        source.setRetrievalType(type);
        return source;
    }
}
