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
        return new Extracted(title,
                bounded(main == null ? document.body().text() : main.text()), publishedAt);
    }

    private Instant parsePublishedDate(String value) {
        if (value == null || value.isBlank()) return null;
        try { return OffsetDateTime.parse(value).toInstant(); }
        catch (Exception ignored) { }
        try { return LocalDate.parse(value, DateTimeFormatter.ofPattern("MMMM d, uuuu", Locale.ENGLISH))
                .atStartOfDay(ZoneId.of("Asia/Manila")).toInstant(); }
        catch (Exception ignored) { return null; }
    }

    private String bounded(String text) {
        String cleaned = text == null ? "" : text.replaceAll("\\s+", " ").trim();
        return cleaned.substring(0, Math.min(cleaned.length(), 60000));
    }

    public record Extracted(String title, String text, Instant publishedAt) {
        public Extracted(String title, String text) { this(title, text, null); }
    }
}
