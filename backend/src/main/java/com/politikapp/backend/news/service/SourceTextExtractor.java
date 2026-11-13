package com.politikapp.backend.news.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import com.politikapp.backend.news.dto.NewsDtos.SourceImageResponse;

@Component
public class SourceTextExtractor {
    public Extracted extract(ApprovedSourceClient.Download download) throws IOException {
        String type = String.valueOf(download.contentType()).toLowerCase(java.util.Locale.ROOT);
        if (type.contains("pdf") || download.uri().getPath().toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")) {
            try (var document = Loader.loadPDF(download.bytes())) {
                if (document.getNumberOfPages() > 200) throw new IOException("PDF exceeds 200 page limit.");
                String text = new PDFTextStripper().getText(document);
                return new Extracted(document.getDocumentInformation().getTitle(), bounded(text), null);
            }
        }
        if (!type.contains("html") && !type.contains("text/plain")) throw new IOException("Unsupported source content type.");
        var document = Jsoup.parse(new ByteArrayInputStream(download.bytes()), null, download.uri().toString());
        var heading = document.selectFirst(".item-page .page-header h2[itemprop=name], .content h1.content-title, article h1, main h1, h1");
        var dateNode = document.selectFirst("time[itemprop=datePublished], time[datetime], meta[property=article:published_time], meta[name=date], .entry-date, .post-date");
        Instant publishedAt = null;
        if (dateNode != null) {
            String value = dateNode.hasAttr("datetime") ? dateNode.attr("datetime")
                    : dateNode.hasAttr("content") ? dateNode.attr("content") : dateNode.text();
            publishedAt = parsePublishedDate(value);
        }
        String title = heading == null ? document.title() : heading.text();
        if (title.length() < 20 && document.title().length() > title.length()) title = document.title();
        title = title.replaceFirst("^dost\\.gov\\.ph\\s*-\\s*", "");
        var authorNode = document.selectFirst("meta[name=author], [rel=author], .byline .author, .entry-meta .author");
        String author = authorNode == null ? null : authorNode.hasAttr("content") ? authorNode.attr("content") : authorNode.text();
        String monthName = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
        for (var node : document.select("article .details, .byline, .entry-meta, article p")) {
            var byline = Pattern.compile("(?i)^Author:\\s*([^|]{1,120})\\s*\\|\\s*(\\d{1,2}\\s+" + monthName + "\\s+\\d{4})").matcher(node.text().trim());
            if (byline.find()) {
                if (author == null || author.isBlank()) author = byline.group(1).trim();
                if (publishedAt == null) publishedAt = parsePublishedDate(byline.group(2));
            }
        }
        SourceImageResponse image = articleImage(document, download.uri(), title);
        document.select("script,style,nav,footer,header,aside,form").remove();
        var main = document.selectFirst("[itemprop=articleBody], .com-content-article__body, .entry-content, .post-content, .article-content, .article-body, article, main, [role=main]");
        if (publishedAt == null && heading != null) {
            String bodyText = document.body().text();
            int titleAt = bodyText.indexOf(heading.text());
            String nearTitle = titleAt < 0 ? "" : bodyText.substring(titleAt,
                    Math.min(bodyText.length(), titleAt + heading.text().length() + 180));
            var date = Pattern.compile("\\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+\\d{4}\\b")
                    .matcher(nearTitle);
            if (date.find()) publishedAt = parsePublishedDate(date.group());
        }
        var body = main == null ? document.body() : main;
        for (var node : body.select(".details")) if (node.text().trim().matches("(?i)^Author:\\s*[^|]{1,120}\\s*\\|\\s*\\d{1,2}\\s+" + monthName + "\\s+\\d{4}\\s*$")) node.remove();
        body.select(".entry-meta, .post-meta, .byline, .author, .posted-on, .entry-date, .post-date, time[itemprop=datePublished], .share-buttons, .social-share, .sharedaddy, .related-posts, .wp-block-post-author, .wp-block-post-date").remove();
        for (var node : body.select("h1,h2")) if (node.text().equalsIgnoreCase(title)) node.remove();
        for (var node : body.select("p")) {
            String value = node.text().trim();
            String cleaned = cleanLeadingMetadata(value, null);
            if (!cleaned.equals(value)) node.text(cleaned);
            else if (value.matches("(?i)^(?:Author|Written by|Published by|Posted by|Photo credit)\\s*:\\s*[\\p{L}\\s.,'-]{1,100}$")) node.remove();
            String noCredit = node.text().replaceFirst("(?i)\\s*#{0,3}\\s*\\(By [^()]{1,180};[^()]{0,120}(?:photo|image)\\)\\s*$", "").trim();
            if (!noCredit.equals(node.text())) node.text(noCredit);
        }
        return new Extracted(title, bounded(cleanLeadingMetadata(body.text(), title)), publishedAt, author, image);
    }

    private Instant parsePublishedDate(String value) {
        if (value == null || value.isBlank()) return null;
        try { return OffsetDateTime.parse(value).toInstant(); }
        catch (Exception ignored) { }
        try { return LocalDate.parse(value).atStartOfDay(ZoneId.of("Asia/Manila")).toInstant(); }
        catch (Exception ignored) { }
        try { return LocalDate.parse(value, DateTimeFormatter.ofPattern("MMMM d, uuuu", Locale.ENGLISH))
                .atStartOfDay(ZoneId.of("Asia/Manila")).toInstant(); }
        catch (Exception ignored) { }
        try { return LocalDate.parse(value, DateTimeFormatter.ofPattern("d MMMM uuuu", Locale.ENGLISH))
                .atStartOfDay(ZoneId.of("Asia/Manila")).toInstant(); }
        catch (Exception ignored) { return null; }
    }

    static String cleanLeadingMetadata(String text, String title) {
        String value = text == null ? "" : text.trim();
        if (title != null && !title.isBlank() && value.equalsIgnoreCase(title)) return "";
        String month = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
        return value.replaceFirst("(?i)^(?:Author|Written by|Published by|Posted by)\\s*:\\s*[^|\\n]{1,120}\\s*\\|\\s*(?:\\d{1,2}\\s+" + month + "\\s+\\d{4}|" + month + "\\s+\\d{1,2},?\\s+\\d{4})\\s*[|:–—-]?\\s*", "");
    }

    private SourceImageResponse articleImage(org.jsoup.nodes.Document document, java.net.URI page, String title) {
        String robots = String.join(" ", document.select("meta[name=robots], meta[name=googlebot]").eachAttr("content")).toLowerCase(Locale.ROOT);
        if (robots.contains("noimageindex")) return null;
        var licenseNode = document.selectFirst("link[rel=license], meta[name=license], meta[property=cc:license]");
        String explicit = licenseNode == null ? "" : licenseNode.hasAttr("href") ? licenseNode.absUrl("href") : licenseNode.attr("content");
        String pageText = document.text().toLowerCase(Locale.ROOT);
        boolean publicDomain = pageText.contains("all content is in the public domain") || pageText.contains("all contents are in the public domain");
        boolean creativeCommons = explicit.matches("https?://creativecommons\\.org/(?:licenses/(?:by|by-sa)/|publicdomain/(?:zero|mark)/).*");
        if (!publicDomain && !creativeCommons) return null; // Unknown reuse rights: image-free presentation.
        String credits = document.select("figcaption, .wp-caption-text, .photo-credit, .image-credit").text();
        var inlineCredit = Pattern.compile("(?i)\\((By [^()]{1,180};[^()]{0,120}(?:photo|image))\\)").matcher(document.select("article, .entry-content, .article-content").text());
        if (inlineCredit.find()) credits = credits.isBlank() ? inlineCredit.group(1) : credits + "; " + inlineCredit.group(1);
        if (credits.matches("(?is).*(?:©|copyright|courtesy|credit:|getty|reuters|agence france.presse|all rights reserved).*")) return null;
        String copyright = document.select("meta[name=copyright]").attr("content").toLowerCase(Locale.ROOT);
        if (copyright.contains("all rights reserved")) return null;
        var candidates = document.select("meta[property=og:image], meta[name=twitter:image], meta[property=og:image:url], article img.wp-post-image, .entry-content figure img, .article-content figure img, article figure img");
        for (var node : candidates) {
            String raw = node.hasAttr("content") ? node.attr("content") : node.hasAttr("data-src") ? node.attr("data-src") : node.attr("src");
            try {
                var uri = page.resolve(raw.trim());
                if (raw.isBlank() || uri.getHost() == null || uri.getUserInfo() != null || uri.getPort() != -1
                        || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                        || !uri.getHost().replaceFirst("^www\\.", "").equalsIgnoreCase(page.getHost().replaceFirst("^www\\.", ""))
                        || !uri.getHost().toLowerCase(Locale.ROOT).endsWith(".gov.ph")
                        || ("https".equalsIgnoreCase(page.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme()))
                        || uri.getPath().toLowerCase(Locale.ROOT).matches(".*(?:logo|favicon|placeholder|tracking|\\.svg).*")) continue;
                var figure = node.closest("figure");
                String caption = figure == null ? credits : figure.select("figcaption").text();
                // The site's general public-domain notice does not override third-party photo credits.
                if (caption.matches("(?is).*(?:©|copyright|courtesy|getty|reuters|agence france.presse|all rights reserved).*")) continue;
                if (caption.toLowerCase(Locale.ROOT).contains("ai-generated")) continue;
                String alt = node.hasAttr("alt") && !node.attr("alt").isBlank() ? node.attr("alt") : "Image accompanying: " + title;
                return new SourceImageResponse(uri.toASCIIString(), alt.length() > 200 ? title : alt,
                        caption.isBlank() || caption.length() > 300 ? "Image from the original government article" : caption,
                        creativeCommons ? explicit : "Source website public-domain notice; exceptions may apply", page.toString());
            } catch (IllegalArgumentException ignored) { /* Try the next original-source candidate. */ }
        }
        return null;
    }

    private String bounded(String text) {
        String cleaned = text == null ? "" : text.replaceAll("\\s+", " ").trim();
        return cleaned.substring(0, Math.min(cleaned.length(), 60000));
    }

    public record Extracted(String title, String text, Instant publishedAt, String author, SourceImageResponse image) {
        public Extracted(String title, String text, Instant publishedAt) { this(title, text, publishedAt, null, null); }
        public Extracted(String title, String text) { this(title, text, null, null, null); }
    }
}
