package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.repository.CommentVoteRepository;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import com.politikapp.backend.news.repository.NewsAuditLogRepository;
import com.politikapp.backend.news.repository.NewsCommentRepository;
import com.politikapp.backend.news.repository.SavedPostRepository;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NewsReviewPublicationTests {
    @Test
    void pendingArticleIsPrivateUntilAdminApprovesAndPublishesIt() {
        var articles = mock(NewsArticleRepository.class);
        var users = mock(AuthUserRepository.class);
        var mapper = mock(NewsMapper.class);
        var admin = new AuthUser();
        UUID adminId = UUID.randomUUID();
        UUID articleId = UUID.randomUUID();
        admin.setUserId(adminId);
        admin.setRole("ADMIN");
        admin.setAccountStatus("ACTIVE");
        var article = new NewsArticle();
        article.setId(articleId);
        article.setStatus("PENDING_REVIEW");
        article.setAiSummary("Verified source excerpt for review.");
        when(users.findById(adminId)).thenReturn(Optional.of(admin));
        when(articles.findForReview(articleId)).thenReturn(Optional.of(article));
        when(articles.save(any(NewsArticle.class))).thenAnswer(call -> call.getArgument(0));
        when(articles.findByIdAndStatus(articleId, "PUBLISHED")).thenAnswer(call ->
                "PUBLISHED".equals(article.getStatus()) ? Optional.of(article) : Optional.empty());
        var review = new AdminNewsService(articles, mock(GovernmentSourceRepository.class),
                mock(NewsAuditLogRepository.class), users, mapper, mock(NewsAiService.class),
                mock(ApprovedSourceClient.class), mock(PoliticianRepository.class));
        var publicNews = new NewsService(articles, mock(NewsCommentRepository.class),
                mock(CommentVoteRepository.class), mock(SavedPostRepository.class), users, mapper);

        assertThrows(HttpResponseException.class, () -> publicNews.publishedById(articleId, null));
        review.approve(articleId, adminId);
        assertEquals("APPROVED", article.getStatus());
        assertThrows(HttpResponseException.class, () -> publicNews.publishedById(articleId, null));
        review.publish(articleId, adminId);
        assertEquals("PUBLISHED", article.getStatus());
        publicNews.publishedById(articleId, null);
        verify(mapper).toArticleResponse(article, false, false);
    }

    @Test
    void metadataOnlyArticleCannotBeApprovedOrPublished() {
        var articles = mock(NewsArticleRepository.class);
        var article = new NewsArticle();
        article.setId(UUID.randomUUID());
        article.setStatus("PENDING_REVIEW");
        article.setAiProcessingStatus("INCOMPLETE");
        article.setAiSummary("Manually entered text is not verified full article content.");
        when(articles.findForReview(article.getId())).thenReturn(Optional.of(article));
        var review = new AdminNewsService(articles, mock(GovernmentSourceRepository.class),
                mock(NewsAuditLogRepository.class), mock(AuthUserRepository.class), mock(NewsMapper.class),
                mock(NewsAiService.class), mock(ApprovedSourceClient.class), mock(PoliticianRepository.class));

        assertThrows(HttpResponseException.class, () -> review.approve(article.getId(), UUID.randomUUID()));
        article.setStatus("APPROVED");
        assertThrows(HttpResponseException.class, () -> review.publish(article.getId(), UUID.randomUUID()));
        verify(articles, never()).save(any());
    }
}
