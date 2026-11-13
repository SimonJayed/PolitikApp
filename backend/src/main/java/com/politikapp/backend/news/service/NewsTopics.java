package com.politikapp.backend.news.service;

import com.politikapp.backend.news.entity.NewsArticle;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Automatic topic selection shared by response mapping and database pagination/filtering. */
public final class NewsTopics {
    private NewsTopics() {}

    // Specific subjects win ties over general spending/announcement language.
    private record Topic(String name, List<String> signals) {}
    private static final List<Topic> TOPICS = List.of(
            new Topic("Audit Reports", List.of("audit report", "audit finding", "commission on audit", " coa ", "coa flags", "disallowance", "unliquidated")),
            new Topic("Legislation", List.of(" bill ", " bills ", "bill no", "bill,", "bill.", "republic act", "legislat", "enacted", "signed into law", "amendment", "proposed law", " resolution", "ordinance")),
            new Topic("Government Projects", List.of(" project ", " projects ", " project,", " project.", "infrastructure", "groundbreak", "inaugurat", "construction", "rehabilitation", "road widening", "bridge opening")),
            new Topic("Public Spending", List.of(" budget", " spending", "allocation", "allocated", "disburse", "procurement", "fund release", "releases fund", "financial assistance", "subsid", "cash aid", "funding", "expenditure", "appropriation", "tariff", " tax ", "taxation"))
    );

    private static String text(String value) { return " " + (value == null ? "" : value.toLowerCase(Locale.ROOT)) + " "; }
    private static String lead(String value) { return value == null ? "" : value.substring(0, Math.min(1500, value.length())); }
    private static boolean matches(String text, Topic topic) { return topic.signals().stream().anyMatch(text::contains); }

    public static String category(NewsArticle article) {
        String headline = text(article.getSuggestedTitle()) + text(article.getOriginalTitle());
        String summary = text(article.getAiSummary());
        String body = text(lead(article.getOriginalContent()));
        int best = 0;
        String category = "Government Announcements";
        for (var topic : TOPICS) {
            int score = (matches(headline, topic) ? 6 : 0) + (matches(summary, topic) ? 3 : 0) + (matches(body, topic) ? 1 : 0);
            if (score > best) { best = score; category = topic.name(); }
        }
        return category;
    }

    private static Expression<String> text(CriteriaBuilder cb, Expression<String> value) {
        return cb.concat(cb.concat(" ", cb.lower(cb.coalesce(value, ""))), " ");
    }

    private static Expression<Integer> score(CriteriaBuilder cb, Expression<String> text, Topic topic, int weight) {
        var signals = topic.signals().stream().map(signal -> cb.gt(cb.locate(text, signal), 0))
                .toArray(jakarta.persistence.criteria.Predicate[]::new);
        return cb.<Integer>selectCase().when(cb.or(signals), weight).otherwise(0);
    }

    public static Expression<String> category(CriteriaBuilder cb, Root<NewsArticle> root) {
        var headline = cb.concat(text(cb, root.get("suggestedTitle")), text(cb, root.get("originalTitle")));
        var summary = text(cb, root.get("aiSummary"));
        var body = text(cb, cb.substring(cb.coalesce(root.<String>get("originalContent"), ""), 1, 1500));
        var scores = new ArrayList<Expression<Integer>>();
        for (var topic : TOPICS) scores.add(cb.sum(cb.sum(score(cb, headline, topic, 6), score(cb, summary, topic, 3)), score(cb, body, topic, 1)));
        var result = cb.<String>selectCase();
        for (int i = 0; i < TOPICS.size(); i++) {
            var wins = cb.gt(scores.get(i), 0);
            for (int j = 0; j < TOPICS.size(); j++) {
                if (j != i) wins = cb.and(wins, j < i ? cb.gt(scores.get(i), scores.get(j)) : cb.ge(scores.get(i), scores.get(j)));
            }
            result.when(wins, TOPICS.get(i).name());
        }
        return result.otherwise("Government Announcements");
    }
}
