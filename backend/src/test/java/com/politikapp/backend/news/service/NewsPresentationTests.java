package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.repository.NewsCommentRepository;
import com.politikapp.backend.news.repository.CommentVoteRepository;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class NewsPresentationTests {
    private SourceTextExtractor.Extracted extract(String html) throws Exception {
        return new SourceTextExtractor().extract(new ApprovedSourceClient.Download(html.getBytes(StandardCharsets.UTF_8),
                "text/html", URI.create("https://www.da.gov.ph/news/aid")));
    }

    @Test
    void extractsPermittedOriginalImageAndSeparatesMetadataFromBody() throws Exception {
        var extracted = extract("""
                <html><head><meta property="og:image" content="/photos/aid.jpg"><meta name="author" content="DA Press Office">
                <meta property="article:published_time" content="2026-10-25T08:00:00+08:00"></head><body>
                <article><h1>Government launches agriculture assistance</h1><p class="byline">Author: DA Press Office | 25 October 2026</p>
                <p>Farmers will receive PHP 50 million in assistance. Applications open in November.</p><div class="social-share">Share this post on Facebook</div></article>
                <footer>All content is in the public domain unless otherwise stated.</footer></body></html>
                """);
        assertEquals("DA Press Office", extracted.author());
        assertEquals(Instant.parse("2026-10-25T00:00:00Z"), extracted.publishedAt());
        assertNotNull(extracted.image());
        assertEquals("https://www.da.gov.ph/photos/aid.jpg", extracted.image().url());
        assertEquals("https://www.da.gov.ph/news/aid", extracted.image().sourceUrl());
        assertFalse(extracted.text().contains("Author:"));
        assertFalse(extracted.text().contains("Share this"));
        assertFalse(extracted.text().contains("Government launches agriculture assistance"));
        assertTrue(extracted.text().contains("PHP 50 million"));
    }

    @Test
    void removesInlineBylineAndDateWithoutDeletingTheActualSentence() throws Exception {
        var extracted = extract("<article><h1>Agriculture assistance announcement</h1><p>Author: DA Press Office | 25 October 2026 Agriculture Secretary announced support for farmers.</p></article>");
        assertEquals("Agriculture Secretary announced support for farmers.", extracted.text());
        assertEquals("Government launches aid to residents.", SourceTextExtractor.cleanLeadingMetadata("Government launches aid to residents.", "Government launches aid"));
    }

    @Test
    void omitsImagesWhenRightsAreUnknownRestrictedOrNotFromTheSource() throws Exception {
        assertNull(extract("<head><meta property='og:image' content='/photo.jpg'></head><article>Source text</article>").image());
        for (String meta : new String[]{"<meta name='robots' content='noimageindex'>", "<meta name='copyright' content='All rights reserved'>"}) {
            assertNull(extract("<head><meta property='og:image' content='/photo.jpg'>" + meta + "</head><body>All content is in the public domain<article>Source text</article></body>").image());
        }
        for (String url : new String[]{"https://unrelated.example/photo.jpg", "javascript:alert(1)", "/assets/logo.png"}) {
            assertNull(extract("<head><meta property='og:image' content='" + url + "'></head><body>All content is in the public domain</body>").image());
        }
        assertNull(extract("<head><meta property='og:image' content='/photo.jpg'></head><body><figcaption>Photo courtesy of Reuters</figcaption>All content is in the public domain</body>").image());
    }

    @Test
    void preservesImageCaptionAndDoesNotInventAPhotographer() throws Exception {
        var result = extract("<article><h1>Government project update</h1><figure><img src='/photo.jpg' alt='Project site'><figcaption>Project site in the province.</figcaption></figure></article><footer>All content is in the public domain</footer>");
        assertEquals("Project site", result.image().alt());
        assertEquals("Project site in the province.", result.image().attribution());
    }

    @Test
    void departmentOfAgricultureDetailsAndInlinePhotoCreditRemainSeparate() throws Exception {
        var result = extract("<head><meta property='og:image' content='/photos/source.jpg'></head><article><div class='details'>Author: DA Press Office | 25 October 2026</div><p>The department announced a support program. <em>### (By DA – OSEC Comms; AFID file photo)</em></p></article><footer>All content is in the public domain unless otherwise stated.</footer>");
        assertEquals("DA Press Office", result.author());
        assertNotNull(result.publishedAt());
        assertEquals("The department announced a support program.", result.text());
        assertTrue(result.image().attribution().contains("AFID file photo"));
    }

    @Test
    void sourceMetadataSurvivesAiExtractionReplacementAndFailure() throws Exception {
        var json = new ObjectMapper();
        var article = new NewsArticle();
        article.setExtractionData("{\"sourceMetadata\":{\"author\":\"DA Press Office\"},\"oldModelField\":true}");
        NewsSourceMetadata.replaceExtraction(article, json.readTree("{\"summary\":\"New draft\",\"sourceMetadata\":{\"author\":\"Model fabrication\"}}"), json);
        assertEquals("DA Press Office", json.readTree(article.getExtractionData()).path("sourceMetadata").path("author").asText());
        NewsSourceMetadata.replaceExtraction(article, null, json);
        assertTrue(json.readTree(article.getExtractionData()).has("sourceMetadata"));
        assertFalse(json.readTree(article.getExtractionData()).has("summary"));
    }

    @Test
    void publicMapperExposesOnlySourceMetadataWithoutChangingReviewedContent() throws Exception {
        var json = new ObjectMapper();
        var source = new GovernmentSource(); source.setName("Department of Agriculture");
        var article = new NewsArticle(); article.setSource(source); article.setSourceUrl("https://www.da.gov.ph/news/aid");
        article.setOriginalTitle("Reviewed headline"); article.setAiSummary("Reviewed summary stays unchanged.");
        article.setAiKeyPoints("Applications open on November 1.\nThe allocation is PHP 50 million.");
        article.setStatus("PUBLISHED"); article.setReviewedAt(Instant.now());
        article.setExtractionData("""
                {"sourceMetadata":{"author":"DA Press Office","image":{"url":"https://www.da.gov.ph/photo.jpg","alt":"Government article image","attribution":"Source article","license":"Source public-domain notice","sourceUrl":"https://www.da.gov.ph/news/aid"}},"evidenceExcerpts":["private draft evidence"],"uncertaintyFlags":["private draft flag"]}
                """);
        var mapper = new NewsMapper(mock(NewsCommentRepository.class), mock(CommentVoteRepository.class), json);
        var response = mapper.toArticleResponse(article, false, false);
        assertTrue(response.extraction().isEmpty());
        assertNotNull(response.image());
        assertEquals("DA Press Office", response.sourceAuthor());
        assertEquals("Reviewed summary stays unchanged.", response.summary());
        assertEquals(2, response.keyPoints().size());
        assertEquals("Reviewed summary stays unchanged.", article.getAiSummary());
        article.setExtractionData("{\"sourceMetadata\":{\"image\":{\"url\":\"javascript:alert(1)\",\"license\":\"unknown\"}}}");
        assertNull(mapper.toArticleResponse(article, false, false).image());
    }
}
