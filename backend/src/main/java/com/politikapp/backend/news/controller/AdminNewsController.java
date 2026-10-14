package com.politikapp.backend.news.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.news.dto.NewsDtos.AdminNewsSummaryResponse;
import com.politikapp.backend.news.dto.NewsDtos.FetchResultResponse;
import com.politikapp.backend.news.dto.NewsDtos.NewsArticleResponse;
import com.politikapp.backend.news.dto.NewsDtos.RejectArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.ReviewArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.SourceResponse;
import com.politikapp.backend.news.service.AdminNewsService;
import com.politikapp.backend.news.service.GovernmentNewsRetrievalService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/news")
@PreAuthorize("hasRole('ADMIN')")
public class AdminNewsController {
    private final AdminNewsService adminNewsService;
    private final GovernmentNewsRetrievalService retrievalService;

    public AdminNewsController(AdminNewsService adminNewsService, GovernmentNewsRetrievalService retrievalService) {
        this.adminNewsService = adminNewsService;
        this.retrievalService = retrievalService;
    }

    @GetMapping
    public Page<NewsArticleResponse> list(
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return adminNewsService.list(status, PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "retrievedAt")));
    }

    @GetMapping("/pending")
    public Page<NewsArticleResponse> pending(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return adminNewsService.pending(PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "retrievedAt")));
    }

    @GetMapping("/summary")
    public AdminNewsSummaryResponse summary() {
        return adminNewsService.summary();
    }

    @GetMapping("/{id}")
    public NewsArticleResponse get(@PathVariable UUID id) {
        return adminNewsService.get(id);
    }

    @PostMapping("/fetch")
    public FetchResultResponse fetch() {
        return retrievalService.fetchLatest();
    }

    @PostMapping("/{id}/process-ai")
    public NewsArticleResponse processAi(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        return adminNewsService.processAi(id, userId(principal));
    }

    @PatchMapping("/{id}")
    public NewsArticleResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewArticleRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return adminNewsService.update(id, request, userId(principal));
    }

    @PostMapping("/{id}/approve")
    public NewsArticleResponse approve(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        return adminNewsService.approve(id, userId(principal));
    }

    @PostMapping("/{id}/reject")
    public NewsArticleResponse reject(
            @PathVariable UUID id,
            @Valid @RequestBody RejectArticleRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return adminNewsService.reject(id, request, userId(principal));
    }

    @PostMapping("/{id}/publish")
    public NewsArticleResponse publish(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        return adminNewsService.publish(id, userId(principal));
    }

    @PostMapping("/{id}/unpublish")
    public NewsArticleResponse unpublish(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        return adminNewsService.unpublish(id, userId(principal));
    }

    @GetMapping("/sources")
    public List<SourceResponse> sources() {
        return adminNewsService.sources();
    }

    private UUID userId(AuthPrincipal principal) {
        return principal == null ? null : principal.getUserId();
    }
}
