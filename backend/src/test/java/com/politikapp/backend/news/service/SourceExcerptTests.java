package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import com.politikapp.backend.news.entity.NewsArticle;
import org.junit.jupiter.api.Test;

class SourceExcerptTests {
    @Test
    void finishesLongSentencesAndKeepsInitialsAndDecimalsTogether() {
        String sentence = "Budget Secretary Kim Robert C. De Leon announced PHP 12.5 million to strengthen accountability and procurement reforms.";
        assertEquals(sentence, SourceExcerpt.excerpt(sentence + " Another sentence follows.", 28));
        assertEquals(sentence, SourceExcerpt.excerpt(sentence + " Another sentence follows.", 70));
        assertEquals("Short sentence.", SourceExcerpt.excerpt("Short sentence.", 520));
        assertEquals("Source has no final punctuation", SourceExcerpt.excerpt("Source has no final punctuation", 10));
    }

    @Test
    void repairsOnlyVerifiableSourceExcerptsWithoutChangingStoredOrAiSummaries() {
        var article = new NewsArticle();
        article.setOriginalContent("The department announced procurement reforms to strengthen accountability. Another sentence.");
        article.setAiSummary("The department announced procurement ref...");
        article.setAiProcessingStatus("DETERMINISTIC");
        assertEquals("The department announced procurement reforms to strengthen accountability.", SourceExcerpt.summary(article));
        assertEquals("The department announced procurement ref...", article.getAiSummary());
        article.setAiProcessingStatus("COMPLETED");
        assertEquals(article.getAiSummary(), SourceExcerpt.summary(article));
        article.setAiProcessingStatus("MOCKED");
        article.setAiSummary("Manually edited summary...");
        assertEquals(article.getAiSummary(), SourceExcerpt.summary(article));
    }
}
