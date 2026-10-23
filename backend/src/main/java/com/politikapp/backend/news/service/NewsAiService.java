package com.politikapp.backend.news.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.NewsArticle;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NewsAiService {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.ai.enabled:${AI_ENABLED:false}}")
    private boolean aiEnabled;

    @Value("${app.ai.mock-mode:${AI_MOCK_MODE:true}}")
    private boolean mockMode;

    @Value("${app.ai.gemini-model:${GEMINI_MODEL:gemini-1.5-flash}}")
    private String model;

    @Value("${app.ai.gemini-api-key:${GEMINI_API_KEY:}}")
    private String apiKey;

    public NewsAiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public void processArticle(NewsArticle article) {
        Instant started = Instant.now();
        article.setStatus("PROCESSING");

        try {
            if (!aiEnabled || mockMode) {
                applyMockResponse(article);
                return;
            }
            if (apiKey == null || apiKey.isBlank()) {
                throw new IllegalStateException("GEMINI_API_KEY is not configured.");
            }

            GeminiNewsResult result = callGemini(article);
            article.setSuggestedTitle(firstNonBlank(result.suggestedHeadline(), article.getOriginalTitle()));
            article.setAiSummary(result.summary().trim());
            article.setAiKeyPoints(String.join("\n", result.keyPoints() == null ? List.of() : result.keyPoints()));
            article.setCategory(validCategory(result.category()));
            article.setAiModel(model);
            article.setAiProcessingStatus("COMPLETED");
            article.setReviewNotes(reviewNotesFor(result));
            article.setStatus("PENDING_REVIEW");
        } catch (Exception exception) {
            article.setAiModel(model);
            article.setAiProcessingStatus("FAILED");
            article.setStatus("PENDING_REVIEW");
            article.setReviewNotes("AI processing failed; admin manual review required. " + safeError(exception.getMessage()));
            if (article.getSuggestedTitle() == null || article.getSuggestedTitle().isBlank()) {
                article.setSuggestedTitle(article.getOriginalTitle());
            }
            if (article.getAiSummary() == null || article.getAiSummary().isBlank()) {
                String content = safeText(article.getOriginalContent());
                article.setAiSummary(content.isBlank()
                        ? "Summary requires admin review because source content was unavailable."
                        : truncate(content, 520));
            }
        } finally {
            article.setAiProcessedAt(Instant.now());
            article.setAiProcessingMs(Duration.between(started, Instant.now()).toMillis());
        }
    }

    private GeminiNewsResult callGemini(NewsArticle article) throws Exception {
        String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
                + URLEncoder.encode(model, StandardCharsets.UTF_8)
                + ":generateContent?key="
                + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        Map<String, Object> payload = Map.of(
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", buildPrompt(article)))
                )),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "responseMimeType", "application/json"
                )
        );

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 429) {
            throw new IllegalStateException("Gemini quota or rate limit reached.");
        }
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Gemini API returned HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
        if (textNode.isMissingNode() || textNode.asText().isBlank()) {
            throw new IllegalStateException("Gemini response did not include JSON text.");
        }
        return parseGeminiJson(textNode.asText());
    }

    GeminiNewsResult parseGeminiJson(String text) throws Exception {
        GeminiNewsResult result = objectMapper.readValue(stripCodeFence(text), GeminiNewsResult.class);
        validateResult(result);
        return result;
    }

    private String buildPrompt(NewsArticle article) {
        return """
                You are processing Philippine government source material for an admin-reviewed civic news feed.
                Return only valid JSON with these fields:
                suggestedHeadline, summary, category, keyPoints, relevantPoliticians, governmentAgency, evidenceExcerpts, uncertaintyFlags.

                Allowed category values: Legislation, Government Projects, Public Spending, Audit Reports, Government Announcements.

                Rules:
                - Use only the supplied title, source, URL, date, and article text.
                - Do not invent facts, people, dates, quotes, or outcomes.
                - Keep language neutral and non-persuasive.
                - Distinguish proposals, announcements, enacted laws, allegations, and completed work.
                - Never imply an allegation is proven.

                Source name: %s
                Source URL: %s
                Original publication date: %s
                Original title: %s
                Article text:
                %s
                """.formatted(
                article.getSource() == null ? "Unknown government source" : article.getSource().getName(),
                article.getSourceUrl(),
                article.getOriginalPublishedAt(),
                article.getOriginalTitle(),
                safeText(article.getOriginalContent())
        );
    }

    private void applyMockResponse(NewsArticle article) {
        String content = safeText(article.getOriginalContent());
        article.setSuggestedTitle(article.getOriginalTitle());
        article.setAiSummary(content.isBlank()
                ? "Summary requires admin review because the source feed did not provide article text."
                : truncate(content, 520));
        article.setAiKeyPoints("Retrieved from an approved government source.");
        article.setCategory(classify(article.getOriginalTitle() + " " + content));
        article.setAiModel("mock-" + model);
        article.setAiProcessingStatus("MOCKED");
        article.setStatus("PENDING_REVIEW");
    }

    private void validateResult(GeminiNewsResult result) {
        if (result == null) throw new IllegalArgumentException("Gemini JSON was empty.");
        if (result.summary() == null || result.summary().isBlank()) {
            throw new IllegalArgumentException("Gemini JSON did not include a summary.");
        }
        if (result.suggestedHeadline() == null || result.suggestedHeadline().isBlank()) {
            throw new IllegalArgumentException("Gemini JSON did not include a suggested headline.");
        }
    }

    private String reviewNotesFor(GeminiNewsResult result) {
        StringBuilder builder = new StringBuilder();
        if (result.governmentAgency() != null && !result.governmentAgency().isBlank()) {
            builder.append("Agency: ").append(result.governmentAgency()).append('\n');
        }
        if (result.relevantPoliticians() != null && !result.relevantPoliticians().isEmpty()) {
            builder.append("Relevant politicians: ").append(String.join(", ", result.relevantPoliticians())).append('\n');
        }
        if (result.uncertaintyFlags() != null && !result.uncertaintyFlags().isEmpty()) {
            builder.append("Uncertainty flags: ").append(String.join("; ", result.uncertaintyFlags())).append('\n');
        }
        if (result.evidenceExcerpts() != null && !result.evidenceExcerpts().isEmpty()) {
            builder.append("Evidence excerpts: ").append(String.join(" | ", result.evidenceExcerpts()));
        }
        return builder.toString().trim();
    }

    private String validCategory(String category) {
        if (category == null) return "Government Announcements";
        return switch (category.trim()) {
            case "Legislation", "Government Projects", "Public Spending", "Audit Reports", "Government Announcements" -> category.trim();
            default -> "Government Announcements";
        };
    }

    private String classify(String text) {
        String normalized = text == null ? "" : text.toLowerCase();
        if (normalized.contains("audit") || normalized.contains("coa")) return "Audit Reports";
        if (normalized.contains("bill") || normalized.contains("act") || normalized.contains("law")) return "Legislation";
        if (normalized.contains("budget") || normalized.contains("spending") || normalized.contains("fund")) return "Public Spending";
        if (normalized.contains("project") || normalized.contains("infrastructure")) return "Government Projects";
        return "Government Announcements";
    }

    private String stripCodeFence(String value) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "");
            cleaned = cleaned.replaceFirst("\\s*```$", "");
        }
        return cleaned.trim();
    }

    private String safeText(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String truncate(String value, int max) {
        if (value.length() <= max) return value;
        return value.substring(0, max - 3).trim() + "...";
    }

    private String firstNonBlank(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first;
    }

    private String safeError(String message) {
        if (message == null || message.isBlank()) return "No error message returned.";
        String cleaned = apiKey == null || apiKey.isBlank() ? message : message.replace(apiKey, "[redacted]");
        return truncate(cleaned, 400);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GeminiNewsResult(
            String suggestedHeadline,
            String summary,
            String category,
            List<String> keyPoints,
            List<String> relevantPoliticians,
            String governmentAgency,
            List<String> evidenceExcerpts,
            List<String> uncertaintyFlags
    ) {}
}
