package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@SuppressWarnings("unchecked")
class NewsAiProviderTests {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient client = mock(HttpClient.class);
    private final NewsAiService service = new NewsAiService(json, mock(PoliticianRepository.class), client);

    private NewsArticle article() {
        ReflectionTestUtils.setField(service, "aiEnabled", true);
        ReflectionTestUtils.setField(service, "mockMode", false);
        ReflectionTestUtils.setField(service, "model", "test-model");
        ReflectionTestUtils.setField(service, "apiKey", "test-secret");
        var article = new NewsArticle();
        article.setOriginalTitle("National budget review");
        article.setOriginalContent("The agency reviewed the national budget. The proposal remains under review.");
        article.setSourceUrl("https://www.dbm.gov.ph/source");
        return article;
    }

    private void response(int status, String body) throws Exception {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    private String providerBody(String evidence) throws Exception {
        String result = json.writeValueAsString(Map.of("suggestedHeadline", "National budget review",
                "summary", "The agency reviewed the national budget.", "category", "Public Spending",
                "keyPoints", List.of("Proposal remains under review."), "relevantPoliticians", List.of(),
                "evidenceExcerpts", List.of(evidence)));
        return json.writeValueAsString(Map.of("candidates", List.of(Map.of("content",
                Map.of("parts", List.of(Map.of("text", result)))))));
    }

    @Test
    void providerModelResourceNameUsesTheCorrectGenerationPath() throws Exception {
        var article = article();
        ReflectionTestUtils.setField(service, "model", "  models/gemini-3.8-flash  ");
        response(200, providerBody("The agency reviewed the national budget."));
        service.processArticle(article);
        var request = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(request.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("/v1beta/models/gemini-3.8-flash:generateContent", request.getValue().uri().getPath());
        assertNull(request.getValue().uri().getQuery());
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("gemini-3.8-flash", article.getAiModel());
    }

    @Test
    void retiredModelErrorPreservesProviderGuidanceWithoutExposingCredentials() throws Exception {
        var article = article();
        response(404, json.writeValueAsString(Map.of("error", Map.of("message",
                "This model is no longer available to new users. Use gemini-3.8-flash. test-secret"))));
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertTrue(article.getReviewNotes().contains("HTTP 404"));
        assertTrue(article.getReviewNotes().contains("no longer available to new users"));
        assertTrue(article.getReviewNotes().contains("gemini-3.8-flash"));
        assertFalse(article.getReviewNotes().contains("test-secret"));
        assertEquals("PENDING_REVIEW", article.getStatus());
    }

    @Test
    void overloadedProviderIsDistinguishedFromRetiredModelAndKeepsManualFallback() throws Exception {
        var article = article();
        response(503, "{\"error\":{\"message\":\"This model is currently experiencing high demand.\"}}");
        service.processArticle(article);
        assertTrue(article.getReviewNotes().contains("HTTP 503"));
        assertTrue(article.getReviewNotes().contains("Retry processing later"));
        assertTrue(article.getReviewNotes().contains("high demand"));
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertEquals(article.getOriginalContent(), article.getAiSummary());
        assertNull(article.getPublishedAt());
    }

    @Test
    void configuredRetrievalProcessesProviderResponseWithoutPublishing() throws Exception {
        var article = article();
        ReflectionTestUtils.setField(service, "discoveryEnabled", true);
        response(200, providerBody("The agency reviewed the national budget."));
        service.prepareRetrievedDraft(article);
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("PENDING_REVIEW", article.getStatus());
        assertEquals("https://www.dbm.gov.ph/source", article.getSourceUrl());
        assertNotNull(article.getExtractionData());
        assertNull(article.getPublishedAt());
    }

    @Test
    void fabricatedEvidenceIsDiscardedAndReplacedWithSourceFallback() throws Exception {
        var article = article();
        response(200, providerBody("A different claim not present in the source."));
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertNull(article.getExtractionData());
        assertEquals(article.getOriginalContent(), article.getAiSummary());
    }

    @Test
    void rateLimitAndMalformedResponsesRemainPrivateFallbacks() throws Exception {
        for (int code : List.of(429, 404, 200)) {
            var article = article();
            response(code, "{\"candidates\":[]}");
            service.processArticle(article);
            assertEquals("FAILED", article.getAiProcessingStatus());
            assertEquals("PENDING_REVIEW", article.getStatus());
            assertFalse(article.getReviewNotes().contains("test-secret"));
        }
    }

    @Test
    void providerTimeoutPreservesSourceAndManualReview() throws Exception {
        var article = article();
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new HttpTimeoutException("Timed out"));
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertEquals("PENDING_REVIEW", article.getStatus());
        assertEquals(article.getOriginalContent(), article.getAiSummary());
    }

    @Test
    void malformedListFieldsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.parseGeminiJson(
                "{\"suggestedHeadline\":\"Title\",\"summary\":\"Summary\",\"keyPoints\":[null]}"));
    }
}
