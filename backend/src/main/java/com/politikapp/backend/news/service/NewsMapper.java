package com.politikapp.backend.news.service;

import com.politikapp.backend.news.dto.NewsDtos.NewsArticleResponse;
import com.politikapp.backend.news.dto.NewsDtos.NewsCommentResponse;
import com.politikapp.backend.news.dto.NewsDtos.SourceResponse;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.entity.NewsComment;
import com.politikapp.backend.news.repository.CommentVoteRepository;
import com.politikapp.backend.news.repository.NewsCommentRepository;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class NewsMapper {
    private final NewsCommentRepository commentRepository;
    private final CommentVoteRepository voteRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper json;

    public NewsMapper(NewsCommentRepository commentRepository, CommentVoteRepository voteRepository, com.fasterxml.jackson.databind.ObjectMapper json) {
        this.commentRepository = commentRepository;
        this.voteRepository = voteRepository;
        this.json = json;
    }

    public NewsArticleResponse toArticleResponse(NewsArticle article, boolean saved) {
        return toArticleResponse(article, saved, true);
    }

    public NewsArticleResponse toArticleResponse(NewsArticle article, boolean saved, boolean admin) {
        return toArticleResponse(article, saved, admin,
                commentRepository.countByArticleIdAndHiddenFalseAndDeletedAtIsNull(article.getId()));
    }

    public org.springframework.data.domain.Page<NewsArticleResponse> toArticlePage(
            org.springframework.data.domain.Page<NewsArticle> articles, java.util.Set<java.util.UUID> savedIds, boolean admin) {
        if (articles.isEmpty()) return articles.map(article -> toArticleResponse(article, false, admin, 0));
        var ids = articles.getContent().stream().map(NewsArticle::getId).toList();
        var counts = commentRepository.countVisibleByArticleIds(ids).stream().collect(java.util.stream.Collectors.toMap(
                NewsCommentRepository.ArticleCommentCount::getArticleId, NewsCommentRepository.ArticleCommentCount::getTotal));
        return articles.map(article -> toArticleResponse(article, savedIds.contains(article.getId()), admin,
                counts.getOrDefault(article.getId(), 0L)));
    }

    private NewsArticleResponse toArticleResponse(NewsArticle article, boolean saved, boolean admin, long commentCount) {
        return new NewsArticleResponse(
                article.getId(),
                firstNonBlank(article.getSuggestedTitle(), article.getOriginalTitle()),
                article.getOriginalTitle(),
                article.getSource().getName(),
                article.getSourceUrl(),
                NewsTopics.category(article),
                firstNonBlank(article.getAiSummary(), article.getOriginalContent()),
                splitKeyPoints(article.getAiKeyPoints()),
                article.getOriginalPublishedAt(),
                article.getPublishedAt(),
                article.getStatus(),
                article.getAiProcessingStatus(),
                article.getOriginalContent(),
                admin ? article.getReviewNotes() : null,
                commentCount,
                article.getReviewedAt() != null && "PUBLISHED".equals(article.getStatus()),
                saved,
                article.getRelatedPoliticians().stream().filter(p -> !"ARCHIVED".equals(p.getStatus())).map(p -> new com.politikapp.backend.news.dto.NewsDtos.RelatedPoliticianResponse(p.getPoliticianId(), p.getFullName())).toList(),
                admin ? extraction(article.getExtractionData()) : json.createObjectNode(),
                extraction(article.getExtractionData()).path("sourceMetadata").path("author").asText(null),
                sourceImage(article)
        );
    }

    private com.politikapp.backend.news.dto.NewsDtos.SourceImageResponse sourceImage(NewsArticle article) {
        try {
            var node = extraction(article.getExtractionData()).path("sourceMetadata").path("image");
            if (!node.isObject() || node.path("license").asText("").isBlank()) return null;
            var image = json.treeToValue(node, com.politikapp.backend.news.dto.NewsDtos.SourceImageResponse.class);
            var uri = java.net.URI.create(image.url());
            var source = java.net.URI.create(article.getSourceUrl());
            if (uri.getHost() == null || source.getHost() == null || uri.getUserInfo() != null
                    || !uri.getHost().toLowerCase(java.util.Locale.ROOT).endsWith(".gov.ph")
                    || !uri.getHost().replaceFirst("^www\\.", "").equalsIgnoreCase(source.getHost().replaceFirst("^www\\.", ""))
                    || !("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) return null;
            return image;
        } catch (Exception ignored) { return null; }
    }

    private com.fasterxml.jackson.databind.JsonNode extraction(String value) {
        try { return value == null ? json.createObjectNode() : json.readTree(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException exception) { return json.createObjectNode(); }
    }

    public NewsCommentResponse toCommentResponse(NewsComment comment) {
        return toCommentResponse(comment, null);
    }

    public NewsCommentResponse toCommentResponse(NewsComment comment, java.util.UUID userId) {
        int upvotes = voteRepository.countByCommentIdAndVoteType(comment.getId(), "UP");
        int downvotes = voteRepository.countByCommentIdAndVoteType(comment.getId(), "DOWN");
        String voteType = userId == null
                ? null
                : voteRepository.findByCommentIdAndUserUserId(comment.getId(), userId)
                        .map(com.politikapp.backend.news.entity.CommentVote::getVoteType)
                        .orElse(null);
        return new NewsCommentResponse(
                comment.getId(),
                "Anonymous",
                comment.getContent(),
                comment.getCreatedAt(),
                upvotes,
                downvotes,
                voteType != null,
                voteType
        );
    }

    public SourceResponse toSourceResponse(GovernmentSource source) {
        return new SourceResponse(
                source.getId(),
                source.getName(),
                source.getBaseUrl(),
                source.getFeedUrl(),
                source.getRetrievalType(),
                source.isActive(),
                source.getLastFetchedAt(),
                source.getLastError()
        );
    }

    private List<String> splitKeyPoints(String keyPoints) {
        if (keyPoints == null || keyPoints.isBlank()) return List.of();
        return Arrays.stream(keyPoints.split("\\R+"))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();
    }

    private String firstNonBlank(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first;
    }
}
