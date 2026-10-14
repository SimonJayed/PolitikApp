package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.NewsArticle;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class NewsAiServiceTests {
    @Test
    void mockModeCreatesPendingReviewArticleWithoutPublishing() {
        NewsAiService service = new NewsAiService(new ObjectMapper());
        ReflectionTestUtils.setField(service, "aiEnabled", false);
        ReflectionTestUtils.setField(service, "mockMode", true);
        ReflectionTestUtils.setField(service, "model", "gemini-test");

        NewsArticle article = new NewsArticle();
        article.setOriginalTitle("COA releases audit report");
        article.setOriginalContent("The Commission on Audit released an audit report about public spending.");

        service.processArticle(article);

        assertEquals("PENDING_REVIEW", article.getStatus());
        assertEquals("MOCKED", article.getAiProcessingStatus());
        assertEquals("Audit Reports", article.getCategory());
        assertTrue(article.getAiSummary().contains("Commission on Audit"));
    }

    @Test
    void realModeWithoutApiKeyFallsBackToManualReview() {
        NewsAiService service = new NewsAiService(new ObjectMapper());
        ReflectionTestUtils.setField(service, "aiEnabled", true);
        ReflectionTestUtils.setField(service, "mockMode", false);
        ReflectionTestUtils.setField(service, "model", "gemini-test");
        ReflectionTestUtils.setField(service, "apiKey", "");

        NewsArticle article = new NewsArticle();
        article.setOriginalTitle("Official update");
        article.setOriginalContent("A source-only article body.");

        service.processArticle(article);

        assertEquals("PENDING_REVIEW", article.getStatus());
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertTrue(article.getReviewNotes().contains("GEMINI_API_KEY"));
    }

    @Test
    void parsesStructuredGeminiJsonInsideCodeFence() throws Exception {
        NewsAiService service = new NewsAiService(new ObjectMapper());
        Object result = service.parseGeminiJson("""
                ```json
                {
                  "suggestedHeadline": "Government agency announces project",
                  "summary": "The article reports an official project announcement.",
                  "category": "Government Projects",
                  "keyPoints": ["Official source", "Project announcement"],
                  "relevantPoliticians": [],
                  "governmentAgency": "Official Gazette",
                  "evidenceExcerpts": ["announces project"],
                  "uncertaintyFlags": []
                }
                ```
                """);

        assertEquals("Government agency announces project", ReflectionTestUtils.invokeMethod(result, "suggestedHeadline"));
        assertEquals("Government Projects", ReflectionTestUtils.invokeMethod(result, "category"));
    }

    @Test
    void rejectsGeminiJsonMissingRequiredFields() {
        NewsAiService service = new NewsAiService(new ObjectMapper());

        assertThrows(IllegalArgumentException.class, () -> service.parseGeminiJson("{\"summary\":\"Only summary\"}"));
    }
}
