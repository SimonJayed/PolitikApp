package com.politikapp.backend.news.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.politikapp.backend.news.entity.NewsArticle;

/** Source metadata survives AI processing; it is never supplied by the model. */
final class NewsSourceMetadata {
    private NewsSourceMetadata() {}

    static void replaceExtraction(NewsArticle article, JsonNode replacement, ObjectMapper json) {
        ObjectNode result = replacement != null && replacement.isObject() ? ((ObjectNode) replacement).deepCopy() : json.createObjectNode();
        try {
            JsonNode previous = article.getExtractionData() == null ? null : json.readTree(article.getExtractionData());
            if (previous != null && previous.path("sourceMetadata").isObject()) result.set("sourceMetadata", previous.path("sourceMetadata"));
        } catch (Exception ignored) { /* Historical malformed extraction is not reused. */ }
        article.setExtractionData(result.isEmpty() ? null : result.toString());
    }
}
