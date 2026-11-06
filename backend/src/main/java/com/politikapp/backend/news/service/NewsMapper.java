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
        return new NewsArticleResponse(
                article.getId(),
                firstNonBlank(article.getSuggestedTitle(), article.getOriginalTitle()),
                article.getOriginalTitle(),
                article.getSource().getName(),
                article.getSourceUrl(),
                article.getCategory(),
                firstNonBlank(article.getAiSummary(), article.getOriginalContent()),
                splitKeyPoints(article.getAiKeyPoints()),
                article.getOriginalPublishedAt(),
                article.getPublishedAt(),
                article.getStatus(),
                article.getAiProcessingStatus(),
                article.getOriginalContent(),
                admin ? article.getReviewNotes() : null,
                commentRepository.countByArticleIdAndHiddenFalseAndDeletedAtIsNull(article.getId()),
                article.getReviewedAt() != null && "PUBLISHED".equals(article.getStatus()),
                saved,
                article.getRelatedPoliticians().stream().filter(p -> !"ARCHIVED".equals(p.getStatus())).map(p -> new com.politikapp.backend.news.dto.NewsDtos.RelatedPoliticianResponse(p.getPoliticianId(), p.getFullName())).toList(),
                extraction(article.getExtractionData())
        );
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
        return new NewsCommentResponse(
                comment.getId(),
                "Anonymous",
                comment.getContent(),
                comment.getCreatedAt(),
                upvotes - downvotes,
                upvotes,
                downvotes,
                userId != null && voteRepository.findByCommentIdAndUserUserId(comment.getId(), userId).isPresent()
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
