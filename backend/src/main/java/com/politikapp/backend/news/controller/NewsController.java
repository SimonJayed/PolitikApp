package com.politikapp.backend.news.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.news.dto.NewsDtos.CreateCommentRequest;
import com.politikapp.backend.news.dto.NewsDtos.NewsArticleResponse;
import com.politikapp.backend.news.dto.NewsDtos.NewsCommentResponse;
import com.politikapp.backend.news.dto.NewsDtos.UserCommentResponse;
import com.politikapp.backend.news.dto.NewsDtos.DashboardSummaryResponse;
import com.politikapp.backend.news.dto.NewsDtos.VoteRequest;
import com.politikapp.backend.news.service.NewsService;
import jakarta.validation.Valid;
import java.util.UUID;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.time.DayOfWeek;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class NewsController {
    private final NewsService newsService;

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    @GetMapping("/news")
    public Page<NewsArticleResponse> news(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "newest") String sort,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        Sort.Direction direction = "oldest".equalsIgnoreCase(sort) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return newsService.published(category, q, PageRequest.of(page, Math.min(size, 30), Sort.by(direction, "publishedAt")), userId(principal));
    }

    @GetMapping("/news/{id}")
    public NewsArticleResponse getNews(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        return newsService.publishedById(id, userId(principal));
    }

    @GetMapping("/news/categories")
    public List<String> categories() {
        return newsService.categories();
    }

    @GetMapping("/news/{id}/comments")
    public List<NewsCommentResponse> comments(@PathVariable UUID id) {
        return newsService.comments(id);
    }

    @PostMapping("/news/{id}/comments")
    public NewsCommentResponse addComment(
            @PathVariable UUID id,
            @Valid @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return newsService.addComment(id, request, userId(principal));
    }

    @PostMapping("/comments/{id}/vote")
    public NewsCommentResponse vote(
            @PathVariable UUID id,
            @Valid @RequestBody VoteRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return newsService.vote(id, request, userId(principal));
    }

    @PostMapping("/news/{id}/save")
    public ResponseEntity<Void> save(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        newsService.savePost(id, userId(principal));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/news/{id}/save")
    public ResponseEntity<Void> unsave(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        newsService.unsavePost(id, userId(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me/comments")
    public List<UserCommentResponse> myComments(@AuthenticationPrincipal AuthPrincipal principal) {
        return newsService.userComments(userId(principal));
    }

    @GetMapping("/me/saved-posts")
    public List<NewsArticleResponse> mySavedPosts(@AuthenticationPrincipal AuthPrincipal principal) {
        return newsService.savedPosts(userId(principal));
    }

    @GetMapping("/news/summary")
    public DashboardSummaryResponse summary() {
        Instant fourteenDaysAgo = Instant.now().minusSeconds(14 * 24 * 60 * 60);
        Instant weekStart = java.time.ZonedDateTime.now(ZoneOffset.UTC)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .toLocalDate()
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant();
        return newsService.summary(fourteenDaysAgo, weekStart);
    }

    private UUID userId(AuthPrincipal principal) {
        return principal == null ? null : principal.getUserId();
    }
}
