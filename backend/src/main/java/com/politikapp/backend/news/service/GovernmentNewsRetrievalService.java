package com.politikapp.backend.news.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.news.dto.NewsDtos.FetchResultResponse;
import com.politikapp.backend.news.dto.NewsDtos.FetchIssue;
import com.politikapp.backend.news.dto.NewsDtos.ManualArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.SourceFetchResult;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.xml.parsers.DocumentBuilderFactory;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.Element;

@Service
public class GovernmentNewsRetrievalService {
    private final GovernmentSourceRepository sources;
    private final NewsArticleRepository articles;
    private final NewsAiService ai;
    private final ApprovedSourceClient client;
    private final SourceTextExtractor extractor;
    private final PoliticalNewsRelevance relevance;
    private final ObjectMapper json;
    private final AtomicBoolean running = new AtomicBoolean();
    @Value("${app.news.scheduled-enabled:false}") private boolean scheduledEnabled;
    @Value("${app.news.retrieval-enabled:false}") private boolean retrievalEnabled;

    public GovernmentNewsRetrievalService(GovernmentSourceRepository sources, NewsArticleRepository articles,
            NewsAiService ai, ApprovedSourceClient client, SourceTextExtractor extractor, ObjectMapper json) {
        this.sources = sources;
        this.articles = articles;
        this.ai = ai;
        this.client = client;
        this.extractor = extractor;
        this.json = json;
        this.relevance = new PoliticalNewsRelevance();
    }

    @Scheduled(cron = "${app.news.fetch-cron:0 15 */6 * * *}")
    public void scheduledFetch() {
        if (scheduledEnabled && retrievalEnabled && !running.get()) fetchLatest();
    }

    public FetchResultResponse fetchLatest() {
        if (!retrievalEnabled) throw new HttpResponseException(409, "Source retrieval is disabled in configuration.");
        if (!running.compareAndSet(false, true)) throw new HttpResponseException(409, "Retrieval is already running.");
        List<SourceFetchResult> sourceResults = new ArrayList<>();
        try {
            for (GovernmentSource source : sources.findByActiveTrue().stream()
                    .filter(source -> !paused(source))
                    .sorted(Comparator.comparing(GovernmentSource::getLastFetchedAt,
                            Comparator.nullsFirst(Comparator.naturalOrder())))
                    .limit(10).toList()) {
                Counters counts = new Counters();
                List<FetchIssue> issues = new ArrayList<>();
                Set<String> blockedHosts = new HashSet<>();
                Set<String> seenUrls = new HashSet<>();
                try {
                    for (Candidate candidate : candidates(source)) {
                        if (Thread.currentThread().isInterrupted()) return aggregate(sourceResults);
                        retrieveCandidate(source, candidate, blockedHosts, seenUrls, counts, issues);
                    }
                } catch (Exception exception) {
                    String endpoint = source.getFeedUrl() == null || source.getFeedUrl().isBlank()
                            ? source.getBaseUrl() : source.getFeedUrl();
                    boolean blocked = exception instanceof ApprovedSourceClient.HttpStatusException status && status.blocked();
                    if (blocked) counts.blocked++;
                    else counts.failed++;
                    issues.add(new FetchIssue("LISTING", blocked ? "BLOCKED" : "FAILED", endpoint, conciseError(exception)));
                }
                source.setLastError(issues.isEmpty() ? null : issues.get(0).stage() + " "
                        + issues.get(0).outcome() + " at " + issues.get(0).url() + ": " + issues.get(0).detail());
                source.setLastFetchedAt(Instant.now());
                sources.save(source);
                sourceResults.add(counts.result(source.getName(), source.getLastError(), issues));
            }
            return aggregate(sourceResults);
        } finally {
            running.set(false);
        }
    }

    /** Explicit admin request; no source configuration or published article is changed. */
    public SourceFetchResult submitUrl(ManualArticleRequest request) {
        if (!retrievalEnabled) throw new HttpResponseException(409, "Source retrieval is disabled in configuration.");
        GovernmentSource source = sources.findById(request.sourceId())
                .filter(GovernmentSource::isActive)
                .filter(item -> !paused(item))
                .orElseThrow(() -> new HttpResponseException(404, "Active government source not found."));
        Counters counts = new Counters();
        List<FetchIssue> issues = new ArrayList<>();
        retrieveCandidate(source, new Candidate(request.url(), request.title(), request.publishedAt()),
                new HashSet<>(), new HashSet<>(), counts, issues);
        return counts.result(source.getName(), issues.isEmpty() ? null : issues.get(0).detail(), issues);
    }

    private void retrieveCandidate(GovernmentSource source, Candidate candidate, Set<String> blockedHosts,
            Set<String> seenUrls, Counters counts, List<FetchIssue> issues) {
        String url = candidate.url();
        try {
            if (candidate.publishedAt() != null && old(candidate.publishedAt())) { counts.skipped++; return; }
            if (candidate.title() != null && !candidate.title().isBlank() && !relevance.relevant(candidate.title())) {
                counts.irrelevant++;
                return;
            }
            URI uri = URI.create(url).normalize();
            client.validate(source, uri);
            if (!isArticlePage(source, uri)) throw new IllegalArgumentException("URL is not a recognized article page.");
            String canonical = canonical(uri);
            if (!seenUrls.add(canonical) || articles.existsByCanonicalUrl(canonical)) {
                counts.duplicates++;
                counts.skipped++;
                return;
            }
            if (!blockedHosts.isEmpty()) {
                counts.notRetried++;
                issues.add(new FetchIssue("ARTICLE", "NOT_RETRIED", canonical, "Source returned an access restriction earlier in this run; request not repeated."));
                saveIncomplete(source, candidate, canonical, "Article access blocked on this host; request not repeated.", counts);
                return;
            }
            ApprovedSourceClient.Download download;
            try { download = client.get(source, uri); }
            catch (ApprovedSourceClient.HttpStatusException status) {
                if (!status.blocked()) throw status;
                blockedHosts.add(status.uri().getHost().toLowerCase(java.util.Locale.ROOT));
                counts.blocked++;
                issues.add(new FetchIssue("ARTICLE", "BLOCKED", status.uri().toString(), conciseError(status)));
                saveIncomplete(source, candidate, canonical, conciseError(status), counts);
                return;
            }
            canonical = canonical(download.uri());
            if (!isArticlePage(source, download.uri())) throw new IllegalArgumentException("Source redirected to a non-article page.");
            if (articles.existsByCanonicalUrl(canonical)) { counts.duplicates++; counts.skipped++; return; }
            var extracted = extractor.extract(download);
            String title = extracted.title() == null || extracted.title().isBlank() ? candidate.title() : extracted.title();
            Instant publishedAt = candidate.publishedAt() == null ? extracted.publishedAt() : candidate.publishedAt();
            if (publishedAt != null && old(publishedAt)) { counts.skipped++; return; }
            if (title != null && !title.isBlank() && !relevance.relevant(title)) { counts.irrelevant++; return; }
            if (extracted.text().length() < 150 || title == null || title.isBlank()) {
                issues.add(new FetchIssue("EXTRACTION", "INCOMPLETE", canonical, "Article title or body could not be extracted reliably."));
                saveIncomplete(source, new Candidate(canonical, candidate.title(), publishedAt), canonical,
                        "Article title or body could not be extracted reliably.", counts);
                return;
            }
            NewsArticle article = new NewsArticle();
            article.setSource(source);
            article.setOriginalTitle(title.trim());
            article.setSourceUrl(canonical);
            article.setCanonicalUrl(canonical);
            article.setOriginalContent(extracted.text());
            article.setOriginalPublishedAt(publishedAt);
            ai.prepareRetrievedDraft(article);
            articles.save(article);
            counts.retrieved++;
        } catch (Exception exception) {
            counts.failed++;
            issues.add(new FetchIssue("ARTICLE", "FAILED", url, conciseError(exception)));
        }
    }

    private void saveIncomplete(GovernmentSource source, Candidate candidate, String canonical,
            String reason, Counters counts) {
        if (candidate.title() == null || candidate.title().isBlank()) {
            counts.failed++;
            return;
        }
        NewsArticle article = new NewsArticle();
        article.setSource(source);
        article.setOriginalTitle(candidate.title().trim());
        article.setSuggestedTitle(candidate.title().trim());
        article.setSourceUrl(canonical);
        article.setCanonicalUrl(canonical);
        article.setOriginalPublishedAt(candidate.publishedAt());
        article.setOriginalContent(null);
        article.setAiSummary(null);
        article.setAiKeyPoints(null);
        article.setAiProcessingStatus("INCOMPLETE");
        article.setStatus("PENDING_REVIEW");
        article.setReviewNotes(reason + " Metadata only; full text and status require independent admin verification.");
        article.setExtractionData(json.createObjectNode().put("completeness", "INCOMPLETE")
                .put("reason", reason).put("sourceUrl", canonical).toString());
        articles.save(article);
        counts.incomplete++;
    }

    private boolean old(Instant date) { return date.isBefore(Instant.now().minus(60, ChronoUnit.DAYS)); }

    private FetchResultResponse aggregate(List<SourceFetchResult> rows) {
        return new FetchResultResponse(rows.stream().mapToInt(SourceFetchResult::retrieved).sum(),
                rows.stream().mapToInt(SourceFetchResult::skipped).sum(),
                rows.stream().mapToInt(SourceFetchResult::failed).sum(),
                rows.stream().mapToInt(SourceFetchResult::duplicates).sum(),
                rows.stream().mapToInt(SourceFetchResult::incomplete).sum(),
                rows.stream().mapToInt(SourceFetchResult::blocked).sum(),
                rows.stream().mapToInt(SourceFetchResult::notRetried).sum(),
                rows.stream().mapToInt(SourceFetchResult::irrelevant).sum(), rows);
    }

    private static final class Counters {
        int retrieved, skipped, failed, duplicates, incomplete, blocked, notRetried, irrelevant;
        SourceFetchResult result(String source, String error, List<FetchIssue> issues) {
            return new SourceFetchResult(source, retrieved, skipped, failed, duplicates, incomplete,
                    blocked, notRetried, irrelevant, error, List.copyOf(issues));
        }
    }

    private String conciseError(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) return exception.getClass().getSimpleName();
        return message.length() > 180 ? message.substring(0, 180) : message;
    }

    private boolean isArticlePage(GovernmentSource source, URI uri) {
        if ("https://www.dost.gov.ph/".equals(source.getBaseUrl())) {
            return uri.getPath().matches("/knowledge-resources/news/[0-9]+-.+\\.html");
        }
        if ("https://www.da.gov.ph/".equals(source.getBaseUrl())) {
            return uri.getPath().length() > 2 && !uri.getPath().startsWith("/category/");
        }
        if ("pia.gov.ph".equalsIgnoreCase(uri.getHost())) {
            return uri.getPath().matches("/news/(?!page/)[^/]+/.+");
        }
        if ("senate.gov.ph".equalsIgnoreCase(uri.getHost())) {
            return uri.getPath().matches("/media/news-release/[0-9]+/?");
        }
        if ("legacy.senate.gov.ph".equalsIgnoreCase(uri.getHost())
                || "www.senate.gov.ph".equalsIgnoreCase(uri.getHost())) {
            return uri.getPath().matches("/press_release/[0-9]{4}/[^/]+\\.asp");
        }
        if ("officialgazette.gov.ph".equalsIgnoreCase(uri.getHost())
                || "www.officialgazette.gov.ph".equalsIgnoreCase(uri.getHost())) {
            return !uri.getPath().endsWith("/file-not-found/");
        }
        return true;
    }

    private boolean paused(GovernmentSource source) {
        return GovernmentNewsSourcePolicy.removed(source);
    }

    List<Candidate> candidates(GovernmentSource source) throws Exception {
        String endpoint = source.getFeedUrl() == null || source.getFeedUrl().isBlank() ? source.getBaseUrl() : source.getFeedUrl();
        if ("HTML".equals(source.getRetrievalType())) {
            var download = client.get(source, URI.create(endpoint));
            var document = Jsoup.parse(new ByteArrayInputStream(download.bytes()), null, download.uri().toString());
            List<Candidate> found = new ArrayList<>();
            String host = download.uri().getHost().toLowerCase(java.util.Locale.ROOT);
            String selector = host.equals("www.da.gov.ph") ? ".content .col-sm-8 h1 a[href]"
                    : host.equals("pia.gov.ph") ? "a[href*=/news/]"
                    : host.endsWith("senate.gov.ph") ? "a[href*=/media/news-release/]" : "article h2 a[href]";
            java.util.Set<String> seen = new java.util.HashSet<>();
            for (var link : document.select(selector)) {
                if (found.size() >= 20) break;
                URI article = download.uri().resolve(link.attr("href"));
                if (isArticlePage(source, article) && seen.add(article.toString())) {
                    found.add(new Candidate(article.toString(), link.text(), null));
                }
            }
            if (found.isEmpty()) throw new IllegalArgumentException("No article links found on source listing.");
            return found;
        }
        var download = client.get(source, URI.create(endpoint));
        List<Candidate> result = new ArrayList<>();
        if ("API".equals(source.getRetrievalType())) {
            // Configured legislative API must provide an array or a data/results/items array.
            var root = json.readTree(download.bytes());
            var rows = root.isArray() ? root : root.path("data");
            if (!rows.isArray()) rows = root.path("results");
            if (!rows.isArray()) rows = root.path("items");
            if (!rows.isArray()) throw new IllegalArgumentException("Legislative API must provide an array of records.");
            for (var row : rows) {
                if (result.size() == 20) break;
                String url = row.path("url").asText(row.path("source_url").asText(row.path("link").asText("")));
                try {
                    if (!url.isBlank()) result.add(new Candidate(download.uri().resolve(url).toString(), row.path("title").asText(""),
                            date(row.path("published_at").asText(row.path("publishedAt").asText(row.path("date").asText(""))))));
                } catch (IllegalArgumentException ignored) {
                    // A malformed source row must not discard the remaining records.
                }
            }
            return result;
        }
        if (!"RSS".equals(source.getRetrievalType())) throw new IllegalArgumentException("Unsupported retrieval type.");
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        var items = factory.newDocumentBuilder().parse(new ByteArrayInputStream(download.bytes())).getElementsByTagName("item");
        for (int i = 0; i < Math.min(items.getLength(), 20); i++) {
            Element item = (Element) items.item(i);
            String link = text(item, "link");
            if (!link.isBlank()) {
                try {
                URI article = download.uri().resolve(link);
                if (source.getBaseUrl().contains("senate.gov.ph") && "http".equalsIgnoreCase(article.getScheme())) {
                    article = new URI("https", null, article.getHost(), -1, article.getPath(), article.getQuery(), null);
                }
                if (isArticlePage(source, article)) {
                    result.add(new Candidate(article.toString(), Jsoup.parse(text(item, "title")).text(), date(text(item, "pubDate"))));
                }
                } catch (IllegalArgumentException ignored) {
                    // Continue with other feed entries when one URL is malformed.
                }
            }
        }
        if (result.isEmpty()) throw new IllegalArgumentException("RSS feed contains no article links.");
        return result;
    }

    void validateApprovedDestination(GovernmentSource source, URI uri) { client.validate(source, uri); }

    private String canonical(URI uri) throws Exception {
        return new URI("https", null, uri.getHost().toLowerCase(java.util.Locale.ROOT), -1,
                uri.getPath().isBlank() ? "/" : uri.getPath(), uri.getQuery(), null).normalize().toString();
    }

    private String text(Element element, String tag) {
        var nodes = element.getElementsByTagName(tag);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
    }

    private Instant date(String value) {
        try { return ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant(); }
        catch (Exception ignored) { }
        try { return java.time.OffsetDateTime.parse(value).toInstant(); }
        catch (Exception ignored) { return null; }
    }

    record Candidate(String url, String title, Instant publishedAt) {}
}
