package com.politikapp.backend.news.service;

import com.politikapp.backend.news.dto.NewsDtos.FetchResultResponse;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Service
public class GovernmentNewsRetrievalService {
    private final GovernmentSourceRepository sourceRepository;
    private final NewsArticleRepository articleRepository;
    private final NewsAiService aiService;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public GovernmentNewsRetrievalService(
            GovernmentSourceRepository sourceRepository,
            NewsArticleRepository articleRepository,
            NewsAiService aiService
    ) {
        this.sourceRepository = sourceRepository;
        this.articleRepository = articleRepository;
        this.aiService = aiService;
    }

    @Scheduled(cron = "${app.news.fetch-cron:0 15 */6 * * *}")
    public void scheduledFetch() {
        fetchLatest();
    }

    public FetchResultResponse fetchLatest() {
        int retrieved = 0;
        int skipped = 0;
        int failed = 0;

        for (GovernmentSource source : sourceRepository.findByActiveTrue()) {
            try {
                FetchCounts counts = fetchSource(source);
                retrieved += counts.retrieved;
                skipped += counts.skipped;
                source.setLastFetchedAt(Instant.now());
                source.setLastError(null);
            } catch (Exception exception) {
                failed++;
                source.setLastError(exception.getMessage());
            }
            sourceRepository.save(source);
        }

        return new FetchResultResponse(retrieved, skipped, failed);
    }

    private FetchCounts fetchSource(GovernmentSource source) throws Exception {
        if (!"RSS".equalsIgnoreCase(source.getRetrievalType()) || source.getFeedUrl() == null) {
            return new FetchCounts(0, 0);
        }

        URI feedUri = URI.create(source.getFeedUrl());
        validateApprovedDestination(source, feedUri);
        HttpRequest request = HttpRequest.newBuilder(feedUri)
                .timeout(Duration.ofSeconds(12))
                .header("User-Agent", "PolitikApp/1.0 government-news-aggregator")
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        validateApprovedDestination(source, response.uri());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Feed returned HTTP " + response.statusCode());
        }

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        NodeList items = factory.newDocumentBuilder()
                .parse(new InputSource(new StringReader(response.body())))
                .getElementsByTagName("item");

        int retrieved = 0;
        int skipped = 0;
        for (int index = 0; index < Math.min(items.getLength(), 20); index++) {
            Element item = (Element) items.item(index);
            String title = text(item, "title");
            String link = text(item, "link");
            if (title.isBlank() || link.isBlank()) {
                skipped++;
                continue;
            }
            URI articleUri = URI.create(link.trim());
            validateApprovedDestination(source, articleUri);
            String canonicalUrl = articleUri.normalize().toString();
            if (articleRepository.existsByCanonicalUrl(canonicalUrl)) {
                skipped++;
                continue;
            }

            NewsArticle article = new NewsArticle();
            article.setSource(source);
            article.setOriginalTitle(title.trim());
            article.setSourceUrl(canonicalUrl);
            article.setCanonicalUrl(canonicalUrl);
            article.setOriginalContent(stripHtml(text(item, "description")));
            article.setOriginalPublishedAt(parseRssDate(text(item, "pubDate")));
            aiService.processArticle(article);
            articleRepository.save(article);
            retrieved++;
        }
        return new FetchCounts(retrieved, skipped);
    }

    void validateApprovedDestination(GovernmentSource source, URI uri) {
        String baseHost = normalizeHost(URI.create(source.getBaseUrl()).getHost());
        String targetHost = normalizeHost(uri.getHost());
        boolean allowed = targetHost != null
                && baseHost != null
                && (targetHost.equals(baseHost) || targetHost.endsWith("." + baseHost));
        if (!allowed) {
            throw new IllegalArgumentException("Blocked unapproved news destination: " + uri);
        }
    }

    private String normalizeHost(String host) {
        if (host == null) return null;
        return host.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
    }

    private String text(Element element, String tagName) {
        NodeList nodes = element.getElementsByTagName(tagName);
        if (nodes.getLength() == 0 || nodes.item(0).getTextContent() == null) return "";
        return nodes.item(0).getTextContent().trim();
    }

    private Instant parseRssDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String stripHtml(String value) {
        if (value == null) return "";
        return value.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    private record FetchCounts(int retrieved, int skipped) {}
}
