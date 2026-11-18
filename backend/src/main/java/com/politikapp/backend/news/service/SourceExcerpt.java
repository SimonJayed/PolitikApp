package com.politikapp.backend.news.service;

import com.politikapp.backend.news.entity.NewsArticle;
import java.util.Set;
import java.util.regex.Pattern;

/** Verbatim source excerpts that finish the sentence crossing the preferred length. */
public final class SourceExcerpt {
    private SourceExcerpt() {}

    private static final Pattern END = Pattern.compile("[.!?][\\\"'”’)]*(?=\\s|$)");
    private static final Set<String> ABBREVIATIONS = Set.of("mr.", "mrs.", "ms.", "dr.", "sec.", "sen.", "rep.", "no.", "jr.", "sr.", "atty.");

    public static String excerpt(String source, int preferredLength) {
        String text = normalize(source);
        if (text.length() <= preferredLength) return text;
        var ends = END.matcher(text);
        while (ends.find()) {
            if (ends.end() < preferredLength) continue;
            String token = text.substring(text.lastIndexOf(' ', ends.start()) + 1, ends.start() + 1);
            if (text.charAt(ends.start()) == '.' && (token.matches("(?:[A-Za-z]\\.)+")
                    || ABBREVIATIONS.contains(token.toLowerCase(java.util.Locale.ROOT))
                    || (ends.start() > 0 && text.charAt(ends.start() - 1) == '.'))) continue;
            return text.substring(0, ends.end());
        }
        // If the source has no later sentence boundary, retain its remaining words.
        return text;
    }

    public static String summary(NewsArticle article) {
        String summary = article.getAiSummary();
        if (summary == null || summary.isBlank()) return excerpt(article.getOriginalContent(), 520);
        if (!Set.of("DETERMINISTIC", "MOCKED", "FAILED").contains(String.valueOf(article.getAiProcessingStatus()))) return summary;
        String normalized = normalize(summary);
        if (!normalized.endsWith("...")) return summary;
        String prefix = normalized.substring(0, normalized.length() - 3).stripTrailing();
        if (prefix.isEmpty() || !normalize(article.getOriginalContent()).startsWith(prefix)) return summary;
        return excerpt(article.getOriginalContent(), prefix.length() + 1);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }
}
