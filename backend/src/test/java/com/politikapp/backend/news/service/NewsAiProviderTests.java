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
    private final PoliticianRepository politicianRepository = mock(PoliticianRepository.class);
    private final NewsAiService service = new NewsAiService(json, politicianRepository, client);

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
    void providerModelResourceNameAndSchemaUseExpectedGenerationPayload() throws Exception {
        var article = article();
        ReflectionTestUtils.setField(service, "model", "  models/gemini-2.5-flash  ");
        response(200, providerBody("The agency reviewed the national budget."));
        service.processArticle(article);
        var request = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(request.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("/v1beta/models/gemini-2.5-flash:generateContent", request.getValue().uri().getPath());
        assertNull(request.getValue().uri().getQuery());
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("gemini-2.5-flash", article.getAiModel());
        assertTrue(article.getReviewNotes().contains("Agency:") || article.getReviewNotes().contains("Evidence excerpts:"));
    }

    @Test
    void retiredModelErrorPreservesProviderGuidanceWithoutExposingCredentials() throws Exception {
        var article = article();
        response(404, json.writeValueAsString(Map.of("error", Map.of("message",
                "This model is no longer available to new users. Use gemini-2.5-flash. test-secret"))));
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertTrue(article.getReviewNotes().contains("HTTP 404"));
        assertTrue(article.getReviewNotes().contains("no longer available to new users"));
        assertTrue(article.getReviewNotes().contains("gemini-2.5-flash"));
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
    void typographicDifferencesInEvidencePassNormalizedVerification() throws Exception {
        var article = article();
        article.setOriginalContent("The agency said \u201Cbudget reforms\u201D \u2014 phase 1 \u2014 remain under review.");
        response(200, providerBody("the agency said \"budget reforms\" - phase 1 - remain under review."));
        service.processArticle(article);
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertFalse(article.getReviewNotes().contains("Evidence mismatch warning"));
    }

    @Test
    void nonVerbatimEvidenceAddsUncertaintyWarningWithoutDiscardingSummary() throws Exception {
        var article = article();
        response(200, providerBody("A paraphrased claim not matching verbatim."));
        service.processArticle(article);
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("The agency reviewed the national budget.", article.getAiSummary());
        assertTrue(article.getExtractionData().contains("did not match the source text verbatim"));
        assertTrue(article.getReviewNotes().contains("Evidence mismatch warning"));
    }

    @Test
    void emptyEvidenceExcerptsAreRejectedAsFailed() throws Exception {
        var article = article();
        String result = json.writeValueAsString(Map.of("suggestedHeadline", "National budget review",
                "summary", "The agency reviewed the national budget.", "category", "Public Spending",
                "keyPoints", List.of("Proposal remains under review."), "relevantPoliticians", List.of(),
                "evidenceExcerpts", List.of()));
        response(200, json.writeValueAsString(Map.of("candidates", List.of(Map.of("content",
                Map.of("parts", List.of(Map.of("text", result))))))));
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertNull(article.getExtractionData());
        assertEquals(article.getOriginalContent(), article.getAiSummary());
    }

    @Test
    void thinkingPartsAreSkippedWhenExtractingJson() throws Exception {
        var article = article();
        String result = json.writeValueAsString(Map.of("suggestedHeadline", "National budget review",
                "summary", "The agency reviewed the national budget.", "category", "Public Spending",
                "keyPoints", List.of("Proposal remains under review."), "relevantPoliticians", List.of(),
                "evidenceExcerpts", List.of("The agency reviewed the national budget.")));
        response(200, json.writeValueAsString(Map.of("candidates", List.of(Map.of(
                "finishReason", "STOP",
                "content", Map.of("parts", List.of(
                        Map.of("thought", true, "text", "Internal reasoning before JSON"),
                        Map.of("text", result)
                )))))));
        service.processArticle(article);
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("The agency reviewed the national budget.", article.getAiSummary());
    }

    @Test
    void safetyFinishReasonFailsWithExplicitReason() throws Exception {
        var article = article();
        response(200, json.writeValueAsString(Map.of("candidates", List.of(Map.of("finishReason", "SAFETY")))));
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertTrue(article.getReviewNotes().contains("SAFETY"));
    }

    @Test
    void transientFailurePreservesExistingDraftSummary() throws Exception {
        var article = article();
        article.setSuggestedTitle("Admin edited headline");
        article.setAiSummary("Admin curated summary that should not be overwritten.");
        article.setAiKeyPoints("Curated key point");
        article.setExtractionData("{\"summary\":\"existing\"}");
        response(503, "{\"error\":{\"message\":\"High demand.\"}}");
        service.processArticle(article);
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertEquals("Admin edited headline", article.getSuggestedTitle());
        assertEquals("Admin curated summary that should not be overwritten.", article.getAiSummary());
        assertEquals("Curated key point", article.getAiKeyPoints());
        assertEquals("{\"summary\":\"existing\"}", article.getExtractionData());
        assertTrue(article.getReviewNotes().contains("existing draft preserved"));
    }

    @Test
    void politicianMatchingHandlesHonorificsAndMiddleInitialsUnambiguously() throws Exception {
        var article = article();
        var politician = new com.politikapp.backend.politician.entity.Politician();
        politician.setPoliticianId(java.util.UUID.randomUUID());
        politician.setFullName("Ferdinand R. Marcos Jr.");
        when(politicianRepository.findByFullNameContainingIgnoreCaseOrderByFullNameAsc("marcos"))
                .thenReturn(List.of(politician));
        String result = json.writeValueAsString(Map.of("suggestedHeadline", "National budget review",
                "summary", "The agency reviewed the national budget.", "category", "Public Spending",
                "keyPoints", List.of("Proposal remains under review."),
                "relevantPoliticians", List.of("President Ferdinand Marcos Jr."),
                "evidenceExcerpts", List.of("The agency reviewed the national budget.")));
        response(200, json.writeValueAsString(Map.of("candidates", List.of(Map.of("content",
                Map.of("parts", List.of(Map.of("text", result))))))));
        service.processArticle(article);
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals(1, article.getRelatedPoliticians().size());
        assertEquals(politician.getPoliticianId(), article.getRelatedPoliticians().iterator().next().getPoliticianId());
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

    @Test
    void transient503RetriesAndSucceedsOnSecondAttempt() throws Exception {
        var article = article();
        HttpResponse<String> unavailable = mock(HttpResponse.class);
        when(unavailable.statusCode()).thenReturn(503);
        when(unavailable.body()).thenReturn("{\"error\":{\"message\":\"High demand\"}}");
        HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn(providerBody("The agency reviewed the national budget."));
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(unavailable, ok);

        service.processArticle(article);
        verify(client, times(2)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("test-model", article.getAiModel());
    }

    @Test
    void exhausted503FallsBackToConfiguredFallbackModel() throws Exception {
        var article = article();
        ReflectionTestUtils.setField(service, "model", "gemini-3.5-flash-lite");
        ReflectionTestUtils.setField(service, "fallbackModel", "gemini-3.8-flash");
        HttpResponse<String> unavailable = mock(HttpResponse.class);
        when(unavailable.statusCode()).thenReturn(503);
        when(unavailable.body()).thenReturn("{\"error\":{\"message\":\"High demand\"}}");
        HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn(providerBody("The agency reviewed the national budget."));
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(unavailable, unavailable, unavailable, ok);

        service.processArticle(article);
        var requests = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(client, times(4)).send(requests.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("/v1beta/models/gemini-3.5-flash-lite:generateContent", requests.getAllValues().get(0).uri().getPath());
        assertEquals("/v1beta/models/gemini-3.8-flash:generateContent", requests.getAllValues().get(3).uri().getPath());
        assertEquals("COMPLETED", article.getAiProcessingStatus());
        assertEquals("gemini-3.8-flash", article.getAiModel());
    }

    @Test
    void rateLimit429DoesNotRetry() throws Exception {
        var article = article();
        response(429, "{\"error\":{\"message\":\"Rate limit\"}}");
        service.processArticle(article);
        verify(client, times(1)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        assertEquals("FAILED", article.getAiProcessingStatus());
        assertTrue(article.getReviewNotes().contains("HTTP 429"));
    }
}
