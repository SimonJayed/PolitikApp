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
            boolean saved,
            List<RelatedPoliticianResponse> relatedPoliticians,
            com.fasterxml.jackson.databind.JsonNode extraction
    ) {}

    public record RelatedPoliticianResponse(UUID id, String fullName) {}

    public record SourceRequest(
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Size(max = 2000) String baseUrl,
            @Size(max = 2000) String feedUrl,
            @jakarta.validation.constraints.Pattern(regexp = "RSS|API|HTML") @NotBlank String retrievalType,
            boolean active
    ) {}

    public record ManualArticleRequest(
            @jakarta.validation.constraints.NotNull UUID sourceId,
            @NotBlank @Size(max = 2000) String url,
            @Size(max = 300) String title,
            Instant publishedAt
    ) {}

    public record NewsCommentResponse(
            UUID id,
            String authorLabel,
            String content,
            Instant createdAt,
            int score,
            int upvotes,
            int downvotes,
            boolean voted
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
            @Size(max = 3000) String reviewNotes,
            @Size(max = 50) List<UUID> relatedPoliticianIds,
            @Size(max = 30) List<@NotBlank @Size(max = 600) String> keyPoints
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

    public record FetchIssue(String stage, String outcome, String url, String detail) {}
    public record SourceFetchResult(String source, int retrieved, int skipped, int failed,
            int duplicates, int incomplete, int blocked, int notRetried, int irrelevant,
            String error, List<FetchIssue> issues) {}
    public record FetchResultResponse(int retrieved, int skipped, int failed,
            int duplicates, int incomplete, int blocked, int notRetried, int irrelevant,
            List<SourceFetchResult> sources) {}
}
