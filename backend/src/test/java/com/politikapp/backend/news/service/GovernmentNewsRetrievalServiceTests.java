package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class GovernmentNewsRetrievalServiceTests {
    private static final String ARTICLE = "https://www.dbm.gov.ph/index.php/homepage-2/4332-budget-scrutiny";

    @Test
    void removedSourceRecordsAreExcludedEvenIfStillMarkedActive() {
        var sources = mock(GovernmentSourceRepository.class);
        var articles = mock(NewsArticleRepository.class);
        var client = mock(ApprovedSourceClient.class);
        var dost = source("https://www.dost.gov.ph/", "RSS");
        dost.setActive(true);
        var da = source("https://www.da.gov.ph/", "HTML");
        da.setActive(true);
        var senate = source("https://senate.gov.ph/", "HTML");
        senate.setActive(true);
        var pia = source("https://pia.gov.ph/", "HTML");
        pia.setActive(true);
        when(sources.findByActiveTrue()).thenReturn(List.of(dost, da, senate, pia));
        var service = new GovernmentNewsRetrievalService(sources, articles, mock(NewsAiService.class), client,
                new SourceTextExtractor(), new ObjectMapper());
        ReflectionTestUtils.setField(service, "retrievalEnabled", true);

        var result = service.fetchLatest();

        assertTrue(result.sources().isEmpty());
        verify(sources, never()).save(any());
        verify(articles, never()).save(any());
        verifyNoInteractions(client);
    }

    @Test
    void piaListingExtractsOnlyArticleLinksAndArticleMetadata() throws Exception {
        var source = source("https://pia.gov.ph/", "HTML");
        source.setFeedUrl("https://pia.gov.ph/news/");
        var client = mock(ApprovedSourceClient.class);
        String url = "https://pia.gov.ph/news/mindanao/nm/normin-task-force-strengthens-coordination/";
        String listing = "<a href='/news/'>News</a><a href='/news/page/2/'>Next</a>"
                + "<h2><a href='" + url + "'>NorMin task force strengthens coordination</a></h2>";
        when(client.get(eq(source), any(URI.class))).thenAnswer(call -> {
            URI uri = call.getArgument(1);
            return new ApprovedSourceClient.Download(listing.getBytes(StandardCharsets.UTF_8), "text/html", uri);
        });
        var service = new GovernmentNewsRetrievalService(mock(GovernmentSourceRepository.class),
                mock(NewsArticleRepository.class), mock(NewsAiService.class), client,
                new SourceTextExtractor(), new ObjectMapper());

        var candidates = service.candidates(source);

        assertEquals(1, candidates.size());
        assertEquals(url, candidates.get(0).url());
        String page = "<html><head><meta property='article:published_time' content='2026-10-29T11:00:00+08:00'></head>"
                + "<body><h1>NorMin task force strengthens coordination to improve public information</h1>"
                + "<div class='entry-content'>Government agencies in Northern Mindanao are strengthening coordination "
                + "and digital communication to help residents access accurate information on public programs. "
                + "The regional task force met with participating agencies and discussed standards for reviewing "
                + "and publishing clear, verified public information.</div></body></html>";
        var extracted = new SourceTextExtractor().extract(new ApprovedSourceClient.Download(
                page.getBytes(StandardCharsets.UTF_8), "text/html", URI.create(url)));
        assertTrue(extracted.text().length() > 150);
        assertNotNull(extracted.publishedAt());
    }

    @Test
    void legacySenateRssUpgradesOfficialArticleLinksToHttps() throws Exception {
        var source = source("https://legacy.senate.gov.ph/", "RSS");
        source.setFeedUrl("https://legacy.senate.gov.ph/rss/rss_news.aspx");
        var client = mock(ApprovedSourceClient.class);
        String feed = "<rss><channel><item><title>Senate press release</title>"
                + "<link>http://www.senate.gov.ph/press_release/2026/1029_example1.asp</link>"
                + "<pubDate>Thu, 29 Oct 2026 04:00:00 +0000</pubDate></item></channel></rss>";
        when(client.get(eq(source), any(URI.class))).thenReturn(new ApprovedSourceClient.Download(
                feed.getBytes(StandardCharsets.UTF_8), "application/rss+xml", URI.create(source.getFeedUrl())));
        var service = new GovernmentNewsRetrievalService(mock(GovernmentSourceRepository.class),
                mock(NewsArticleRepository.class), mock(NewsAiService.class), client,
                new SourceTextExtractor(), new ObjectMapper());

        var candidates = service.candidates(source);

        assertEquals(1, candidates.size());
        assertEquals("https://www.senate.gov.ph/press_release/2026/1029_example1.asp", candidates.get(0).url());
        assertNotNull(candidates.get(0).publishedAt());
    }

    @Test
    void approvedDestinationAllowsOnlyApprovedSourceHosts() {
        var source = source("https://www.dbm.gov.ph/", "RSS");
        var client = new ApprovedSourceClient("www.dbm.gov.ph,www.da.gov.ph");
        assertDoesNotThrow(() -> client.validate(source, URI.create(ARTICLE)));
        assertThrows(IllegalArgumentException.class,
                () -> client.validate(source, URI.create("https://evil-dbm.gov.ph/article")));
        assertThrows(IllegalArgumentException.class,
                () -> client.validate(source, URI.create("https://www.da.gov.ph/article")));
    }

    @Test
    void legacySenateFeedCanLinkOnlyToApprovedOfficialSenateHosts() {
        var source = source("https://legacy.senate.gov.ph/", "RSS");
        var client = new ApprovedSourceClient("legacy.senate.gov.ph,senate.gov.ph,www.senate.gov.ph");
        assertDoesNotThrow(() -> client.validate(source,
                URI.create("https://www.senate.gov.ph/press_release/2026/1029_example.asp")));
        assertThrows(IllegalArgumentException.class, () -> client.validate(source,
                URI.create("https://other.senate.gov.ph/press_release/2026/1029_example.asp")));
        assertThrows(IllegalArgumentException.class, () -> client.validate(source,
                URI.create("http://www.senate.gov.ph/press_release/2026/1029_example.asp")));
    }

    @Test
    void fetchCreatesPendingDraftThenSkipsDuplicateWithoutGemini() throws Exception {
        var sources = mock(GovernmentSourceRepository.class);
        var articles = mock(NewsArticleRepository.class);
        var client = mock(ApprovedSourceClient.class);
        var source = source("https://www.dbm.gov.ph/", "RSS");
        source.setName("Department of Budget and Management");
        source.setFeedUrl("https://www.dbm.gov.ph/index.php/management-2?format=feed&type=rss");
        source.setActive(true);
        when(sources.findByActiveTrue()).thenReturn(List.of(source));
        var feed = "<rss><channel><item><title>National budget undergoes scrutiny</title><link>" + ARTICLE
                + "</link><pubDate>Wed, 28 Oct 2026 04:56:30 +0000</pubDate></item></channel></rss>";
        var page = "<html><head><meta property='article:published_time' content='2026-10-28T04:56:30+00:00'></head>"
                + "<body><h1>National budget undergoes rigorous scrutiny</h1><article>"
                + "The Department of Budget and Management explained how the national budget undergoes legislative scrutiny. "
                + "The proposal is reviewed by Congress and Senate before the final appropriations become law."
                + "</article></body></html>";
        when(client.get(eq(source), any(URI.class))).thenAnswer(call -> {
            URI uri = call.getArgument(1);
            return uri.toString().contains("format=feed")
                    ? new ApprovedSourceClient.Download(feed.getBytes(StandardCharsets.UTF_8), "application/rss+xml", uri)
                    : new ApprovedSourceClient.Download(page.getBytes(StandardCharsets.UTF_8), "text/html", uri);
        });
        var json = new ObjectMapper();
        var service = new GovernmentNewsRetrievalService(sources, articles,
                new NewsAiService(json, mock(PoliticianRepository.class)), client, new SourceTextExtractor(), json);
        ReflectionTestUtils.setField(service, "retrievalEnabled", true);

        var first = service.fetchLatest();
        assertEquals(1, first.retrieved());
        var saved = ArgumentCaptor.forClass(NewsArticle.class);
        verify(articles).save(saved.capture());
        assertEquals("PENDING_REVIEW", saved.getValue().getStatus());
        assertEquals(1, first.sources().size());
        assertEquals(1, first.sources().get(0).retrieved());
        assertEquals("DETERMINISTIC", saved.getValue().getAiProcessingStatus());
        assertEquals(ARTICLE, saved.getValue().getSourceUrl());
        assertNotNull(saved.getValue().getOriginalPublishedAt());

        when(articles.existsByCanonicalUrl(ARTICLE)).thenReturn(true);
        var second = service.fetchLatest();
        assertEquals(0, second.retrieved());
        assertEquals(1, second.skipped());
        verify(articles, times(1)).save(any(NewsArticle.class));
    }

    @Test
    void inaccessibleSourceDoesNotStopAnotherSource() throws Exception {
        var sources = mock(GovernmentSourceRepository.class);
        var articles = mock(NewsArticleRepository.class);
        var client = mock(ApprovedSourceClient.class);
        var blocked = source("https://www.officialgazette.gov.ph/", "RSS");
        blocked.setFeedUrl("https://www.officialgazette.gov.ph/feed/");
        blocked.setActive(true);
        var dbm = source("https://www.dbm.gov.ph/", "RSS");
        dbm.setFeedUrl("https://www.dbm.gov.ph/index.php/management-2?format=feed&type=rss");
        dbm.setActive(true);
        when(sources.findByActiveTrue()).thenReturn(List.of(blocked, dbm));
        when(client.get(eq(blocked), any(URI.class))).thenThrow(new IOException("HTTP 403"));
        String feed = "<rss><channel><item><title>National budget undergoes scrutiny</title><link>" + ARTICLE + "</link></item></channel></rss>";
        when(client.get(eq(dbm), any(URI.class))).thenAnswer(call -> {
            URI uri = call.getArgument(1);
            if (uri.toString().contains("format=feed")) return new ApprovedSourceClient.Download(
                    feed.getBytes(StandardCharsets.UTF_8), "application/rss+xml", uri);
            return new ApprovedSourceClient.Download(("<h1>National budget undergoes scrutiny</h1><article>"
                    + "The budget proposal has been scrutinized by lawmakers before final approval. "
                    + "The Department of Budget and Management described the checks and balances governing public funds."
                    + "</article>").getBytes(StandardCharsets.UTF_8), "text/html", uri);
        });
        var json = new ObjectMapper();
        var service = new GovernmentNewsRetrievalService(sources, articles,
                new NewsAiService(json, mock(PoliticianRepository.class)), client, new SourceTextExtractor(), json);
        ReflectionTestUtils.setField(service, "retrievalEnabled", true);

        var result = service.fetchLatest();
        assertEquals(1, result.retrieved());
        assertEquals(1, result.failed());
        assertNotNull(blocked.getLastError());
        assertEquals(2, result.sources().size());
        assertEquals(1, result.sources().stream().filter(row -> row.failed() > 0).count());
        verify(articles).save(any(NewsArticle.class));
    }

    @Test
    void blockedGazetteArticlesRetainFeedMetadataWithoutRepeatingTheBlockedRequest() throws Exception {
        var sources = mock(GovernmentSourceRepository.class);
        var articles = mock(NewsArticleRepository.class);
        var client = mock(ApprovedSourceClient.class);
        var ai = mock(NewsAiService.class);
        var gazette = source("https://www.officialgazette.gov.ph/", "RSS");
        gazette.setName("Official Gazette");
        gazette.setFeedUrl("https://www.officialgazette.gov.ph/feed/");
        gazette.setActive(true);
        when(sources.findAll()).thenReturn(List.of(gazette));
        when(sources.findByActiveTrue()).thenReturn(List.of(gazette));
        String first = "https://www.officialgazette.gov.ph/2026/10/28/executive-order-no-129-s-2026/";
        String second = "https://www.officialgazette.gov.ph/2026/10/28/executive-order-no-128-s-2026/";
        String feed = "<rss><channel><item><title>Executive Order No. 129 s. 2026</title><link>" + first
                + "</link><pubDate>Wed, 28 Oct 2026 08:25:31 +0000</pubDate></item>"
                + "<item><title>Executive Order No. 128 s. 2026</title><link>" + second
                + "</link><pubDate>Wed, 28 Oct 2026 08:15:31 +0000</pubDate></item></channel></rss>";
        when(client.get(eq(gazette), any(URI.class))).thenAnswer(call -> {
            URI uri = call.getArgument(1);
            if (uri.toString().equals(gazette.getFeedUrl())) return new ApprovedSourceClient.Download(
                    feed.getBytes(StandardCharsets.UTF_8), "application/rss+xml", uri);
            throw new ApprovedSourceClient.HttpStatusException(403, uri);
        });
        var service = new GovernmentNewsRetrievalService(sources, articles, ai, client,
                new SourceTextExtractor(), new ObjectMapper());
        ReflectionTestUtils.setField(service, "retrievalEnabled", true);

        var result = service.fetchLatest();

        assertEquals(2, result.incomplete());
        assertEquals(1, result.blocked());
        assertEquals(1, result.notRetried());
        assertEquals(0, result.failed());
        assertEquals("ARTICLE", result.sources().get(0).issues().get(0).stage());
        assertEquals(first, result.sources().get(0).issues().get(0).url());
        assertEquals("NOT_RETRIED", result.sources().get(0).issues().get(1).outcome());
        verify(client, times(1)).get(gazette, URI.create(first));
        verify(client, never()).get(gazette, URI.create(second));
        var saved = ArgumentCaptor.forClass(NewsArticle.class);
        verify(articles, times(2)).save(saved.capture());
        for (var article : saved.getAllValues()) {
            assertEquals("PENDING_REVIEW", article.getStatus());
            assertEquals("INCOMPLETE", article.getAiProcessingStatus());
            assertNull(article.getOriginalContent());
            assertNull(article.getAiSummary());
            assertNotNull(article.getOriginalPublishedAt());
        }
        verifyNoInteractions(ai);
    }

    @Test
    void blockedListingReportsTheEndpointAndDoesNotCreateAnArticle() throws Exception {
        var sources = mock(GovernmentSourceRepository.class);
        var articles = mock(NewsArticleRepository.class);
        var client = mock(ApprovedSourceClient.class);
        var blocked = source("https://www.officialgazette.gov.ph/", "RSS");
        blocked.setName("Official Gazette");
        blocked.setFeedUrl("https://www.officialgazette.gov.ph/feed/");
        blocked.setActive(true);
        when(sources.findByActiveTrue()).thenReturn(List.of(blocked));
        when(client.get(eq(blocked), eq(URI.create(blocked.getFeedUrl()))))
                .thenThrow(new ApprovedSourceClient.HttpStatusException(403, URI.create(blocked.getFeedUrl())));
        var service = new GovernmentNewsRetrievalService(sources, articles, mock(NewsAiService.class), client,
                new SourceTextExtractor(), new ObjectMapper());
        ReflectionTestUtils.setField(service, "retrievalEnabled", true);

        var result = service.fetchLatest();

        assertEquals(1, result.blocked());
        assertEquals(0, result.incomplete());
        assertEquals("LISTING", result.sources().get(0).issues().get(0).stage());
        assertEquals(blocked.getFeedUrl(), result.sources().get(0).issues().get(0).url());
        verify(articles, never()).save(any());
    }

    @Test
    void manuallySubmittedApprovedUrlUsesTheExistingExtractionPath() throws Exception {
        var sources = mock(GovernmentSourceRepository.class);
        var articles = mock(NewsArticleRepository.class);
        var client = mock(ApprovedSourceClient.class);
        var source = source("https://www.dbm.gov.ph/", "RSS");
        source.setName("Department of Budget and Management");
        source.setActive(true);
        source.setId(UUID.randomUUID());
        String url = ARTICLE;
        when(sources.findById(source.getId())).thenReturn(Optional.of(source));
        when(client.get(eq(source), eq(URI.create(url)))).thenReturn(new ApprovedSourceClient.Download(
                ("<h1>National budget undergoes scrutiny</h1><article>"
                        + "The Department of Budget and Management described the review process for the national budget. "
                        + "Lawmakers assessed the proposed spending and explained the legislative safeguards for public funds."
                        + "</article>").getBytes(StandardCharsets.UTF_8), "text/html", URI.create(url)));
        var json = new ObjectMapper();
        var service = new GovernmentNewsRetrievalService(sources, articles,
                new NewsAiService(json, mock(PoliticianRepository.class)), client, new SourceTextExtractor(), json);
        ReflectionTestUtils.setField(service, "retrievalEnabled", true);

        var result = service.submitUrl(new com.politikapp.backend.news.dto.NewsDtos.ManualArticleRequest(
                source.getId(), url, null, null));

        assertEquals(1, result.retrieved());
        assertEquals(0, result.failed());
        verify(articles).save(argThat(article -> "PENDING_REVIEW".equals(article.getStatus())));
    }

    private GovernmentSource source(String base, String type) {
        var source = new GovernmentSource();
        source.setBaseUrl(base);
        source.setRetrievalType(type);
        return source;
    }
}
