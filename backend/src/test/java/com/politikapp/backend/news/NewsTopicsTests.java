package com.politikapp.backend.news;

import static org.junit.jupiter.api.Assertions.*;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.service.NewsService;
import com.politikapp.backend.news.service.NewsTopics;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class NewsTopicsTests {
    @Autowired EntityManager em;
    @Autowired NewsService news;

    @Test
    void topicsUseTheMainSubjectInsteadOfIncidentalWordsOrStoredLabels() {
        assertTopic("Audit Reports", "COA flags unliquidated road project funds", "The audit findings concern procurement.");
        assertTopic("Legislation", "Senate files bill for bridge construction", "The measure proposes a new budget allocation.");
        assertTopic("Government Projects", "DPWH inaugurates new bridge project", "The project has an allocated budget.");
        assertTopic("Public Spending", "DBM releases budget allocation", "Funding supports existing public services.");
        assertTopic("Government Announcements", "DA expands market access", "Coastal factories support a billion consumers. Officials discussed lawful trade.");
        assertTopic("Legislation", "PRESIDENT SIGNS REPUBLIC ACT 12345", "The new law establishes public services.");
        assertTopic("Audit Reports", "Annual agency update", "The Commission on Audit published audit findings.");
    }

    private void assertTopic(String expected, String title, String summary) {
        var article = new NewsArticle();
        article.setOriginalTitle(title);
        article.setAiSummary(summary);
        article.setCategory("Government Announcements");
        assertEquals(expected, NewsTopics.category(article));
    }

    @Test
    void existingArticlesHaveMatchingResponseTopicsDatabaseFiltersAndPaginationWithoutRewritingRecords() {
        String marker = "topic-fixture-" + UUID.randomUUID();
        var admin = new AuthUser();
        admin.setUserId(UUID.randomUUID()); admin.setEmail(marker + "@test.invalid");
        admin.setUsername(marker); admin.setFullName("Topic test admin");
        admin.setPasswordHash("test-only"); admin.setRole("ADMIN"); admin.setAccountStatus("ACTIVE");
        em.persist(admin);
        var source = new GovernmentSource(); source.setName(marker); source.setBaseUrl("https://www.da.gov.ph/"); em.persist(source);
        var titles = List.of("COA flags unliquidated funds", "Senate files bill for a new project", "DPWH inaugurates bridge project", "DBM releases budget allocation", "DA expands market access", "House files bill for agricultural research");
        var topics = List.of("Audit Reports", "Legislation", "Government Projects", "Public Spending", "Government Announcements", "Legislation");
        var ids = new java.util.ArrayList<UUID>();
        for (int i = 0; i < titles.size(); i++) {
            var article = new NewsArticle(); article.setSource(source);
            article.setOriginalTitle(titles.get(i)); article.setAiSummary("Reviewed details. " + marker);
            article.setOriginalContent("Original source text.");
            article.setSourceUrl(source.getBaseUrl() + UUID.randomUUID()); article.setCanonicalUrl(article.getSourceUrl());
            article.setCategory("Government Announcements"); article.setStatus("PUBLISHED");
            article.setReviewedBy(admin); article.setReviewedAt(Instant.now()); article.setPublishedAt(Instant.now());
            em.persist(article); ids.add(article.getId());
        }
        em.flush(); em.clear();
        var sort = Sort.by("originalTitle");
        for (int i = 0; i < ids.size(); i++) assertEquals(topics.get(i), news.publishedById(ids.get(i), null).category());
        for (String topic : topics.stream().distinct().toList()) {
            var result = news.published(topic, marker, PageRequest.of(0, 1, sort), null);
            assertEquals(topic.equals("Legislation") ? 2 : 1, result.getTotalElements());
            assertEquals(topic, result.getContent().get(0).category());
            if (topic.equals("Legislation")) {
                var next = news.published(topic, marker, PageRequest.of(1, 1, sort), null);
                assertEquals(2, next.getTotalPages());
                assertNotEquals(result.getContent().get(0).id(), next.getContent().get(0).id());
                assertEquals(topic, next.getContent().get(0).category());
            }
        }
        em.flush(); em.clear();
        for (var id : ids) {
            var stored = em.find(NewsArticle.class, id);
            assertEquals("Government Announcements", stored.getCategory());
            assertNotNull(stored.getReviewedAt()); assertEquals("PUBLISHED", stored.getStatus());
        }
    }
}
