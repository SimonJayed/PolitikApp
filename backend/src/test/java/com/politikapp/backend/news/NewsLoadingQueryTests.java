package com.politikapp.backend.news;

import static org.junit.jupiter.api.Assertions.*;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.news.entity.*;
import com.politikapp.backend.news.service.AdminNewsService;
import com.politikapp.backend.news.service.NewsService;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.service.PoliticianService;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.stat=OFF",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF"
})
@Transactional
class NewsLoadingQueryTests {
    @Autowired EntityManager em;
    @Autowired AdminNewsService admin;
    @Autowired NewsService news;
    @Autowired PoliticianService politicians;
    private Statistics statistics;
    private UUID userId;
    private UUID commentedArticle;
    private final PageRequest page = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "retrievedAt"));

    @BeforeEach
    void fixtures() {
        var user = new AuthUser();
        user.setUserId(UUID.randomUUID());
        user.setEmail(UUID.randomUUID() + "@test.invalid");
        user.setUsername(UUID.randomUUID().toString());
        user.setFullName("Query test user");
        user.setPasswordHash("test-fixture-hash");
        user.setRole("ADMIN");
        user.setAccountStatus("ACTIVE");
        em.persist(user);
        userId = user.getUserId();
        for (int i = 0; i < 30; i++) {
            var politician = new Politician();
            politician.setFullName("Query fixture " + i);
            politician.setPosition("SENATOR");
            politician.setJurisdiction("NATIONAL");
            politician.setTermStart(LocalDate.of(2025, 6, 30));
            politician.setTermEnd(LocalDate.of(2031, 6, 30));
            em.persist(politician);
            var timeline = new TimelineEntry();
            timeline.setPoliticianId(politician.getPoliticianId());
            timeline.setCategoryTag("Legislation");
            timeline.setActionIdentifier("SPONSORED_LEGISLATION");
            timeline.setActionDetails(Map.of("legislativeStatus", "Filed"));
            timeline.setSummary("Test fixture legislation");
            em.persist(timeline);
            var source = new GovernmentSource();
            source.setName("Query source " + i);
            source.setBaseUrl("https://www.dbm.gov.ph/");
            em.persist(source);
            var article = new NewsArticle();
            article.setSource(source);
            article.setOriginalTitle("Query article " + i);
            article.setOriginalContent("Fixture article body");
            article.setAiSummary("Fixture summary");
            article.setSourceUrl("https://www.dbm.gov.ph/test-" + UUID.randomUUID());
            article.setCanonicalUrl(article.getSourceUrl());
            article.setStatus("PUBLISHED");
            article.setReviewedBy(user);
            article.setReviewedAt(Instant.now());
            article.setPublishedAt(Instant.now());
            article.setRetrievedAt(Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i));
            article.getRelatedPoliticians().add(politician);
            em.persist(article);
            if (i == 29) {
                commentedArticle = article.getId();
                em.persist(new SavedPost(userId, article));
                for (int j = 0; j < 3; j++) {
                    var comment = new NewsComment();
                    comment.setArticle(article);
                    comment.setUser(user);
                    comment.setContent("Fixture comment");
                    comment.setHidden(j == 1);
                    if (j == 2) comment.setDeletedAt(Instant.now());
                    em.persist(comment);
                }
            }
        }
        em.flush();
        em.clear();
        statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
    }

    @Test
    void adminPageBatchesCommentsSourcesAndRelatedPoliticians() {
        var result = admin.list("ALL", page);
        assertEquals(20, result.getContent().size());
        assertEquals(30, result.getTotalElements());
        var first = result.getContent().stream().filter(a -> a.id().equals(commentedArticle)).findFirst().orElseThrow();
        assertEquals(1, first.commentCount());
        assertEquals(1, first.relatedPoliticians().size());
        assertTrue(statistics.getPrepareStatementCount() <= 5,
                "Admin page must use bounded queries, got " + statistics.getPrepareStatementCount());
        System.out.println("Admin news page SQL statements: " + statistics.getPrepareStatementCount());
    }

    @Test
    void publicPageBatchesBookmarksAndPreservesVisibleCommentCounts() {
        var result = news.published(null, null, page, userId);
        var first = result.getContent().stream().filter(a -> a.id().equals(commentedArticle)).findFirst().orElseThrow();
        assertTrue(first.saved());
        assertEquals(1, result.stream().filter(a -> a.saved()).count());
        assertEquals(1, first.commentCount());
        assertTrue(first.adminVerified());
        assertTrue(statistics.getPrepareStatementCount() <= 6,
                "Public page must use bounded queries, got " + statistics.getPrepareStatementCount());
        System.out.println("Public news page SQL statements: " + statistics.getPrepareStatementCount());
    }

    @Test
    void directoryBatchesTimelineRecordsAndSummaryUsesOneAggregate() {
        var result = politicians.getPoliticians();
        assertEquals(30, result.size());
        assertTrue(result.stream().allMatch(p -> p.billsAuthored() == 1));
        assertEquals(3, statistics.getPrepareStatementCount());
        System.out.println("Politician directory SQL statements: " + statistics.getPrepareStatementCount());
        statistics.clear();
        var summary = admin.summary();
        assertEquals(30, summary.publishedArticles());
        assertEquals(0, summary.pendingReview());
        assertEquals(0, summary.rejectedArticles());
        assertEquals(1, statistics.getPrepareStatementCount());
    }
}
