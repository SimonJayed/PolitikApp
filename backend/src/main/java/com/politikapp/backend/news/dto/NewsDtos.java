package com.politikapp.backend.news.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class NewsDtos {
    public record NewsArticleResponse(
            UUID id,
            String headline,
            String originalTitle,
            String sourceName,
            String sourceUrl,
            String category,
            String summary,
            List<String> keyPoints,
            Instant originalPublishedAt,
            Instant publishedAt,
            String status,
            String aiProcessingStatus,
            String originalContent,
            String reviewNotes,
            long commentCount,
            boolean adminVerified,
            boolean saved
    ) {}

    public record NewsCommentResponse(
            UUID id,
            String authorLabel,
            String content,
            Instant createdAt,
            int score
    ) {}

    public record UserCommentResponse(
            UUID id,
            UUID articleId,
            String articleTitle,
            String content,
            Instant createdAt,
            int score
    ) {}

    public record DashboardSummaryResponse(
            long legislativeRecordsTracked,
            long recentGovernmentUpdates,
            long activeCitizenDiscussions
    ) {}

    public record CreateCommentRequest(
            @NotBlank @Size(max = 1000) String content
    ) {}

    public record VoteRequest(
            @NotBlank String voteType
    ) {}

    public record ReviewArticleRequest(
            @NotBlank @Size(max = 300) String suggestedTitle,
            @NotBlank @Size(max = 3000) String aiSummary,
            @NotBlank @Size(max = 80) String category,
            @Size(max = 3000) String reviewNotes
    ) {}

    public record RejectArticleRequest(
            @NotBlank @Size(max = 1000) String reason
    ) {}

    public record SourceResponse(
            UUID id,
            String name,
            String baseUrl,
            String feedUrl,
            String retrievalType,
            boolean active,
            Instant lastFetchedAt,
            String lastError
    ) {}

    public record AdminNewsSummaryResponse(
            long pendingReview,
            long publishedArticles,
            long rejectedArticles
    ) {}

    public record FetchResultResponse(int retrieved, int skipped, int failed) {}
}
