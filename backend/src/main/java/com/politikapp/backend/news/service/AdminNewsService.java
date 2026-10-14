package com.politikapp.backend.news.service;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.news.dto.NewsDtos.AdminNewsSummaryResponse;
import com.politikapp.backend.news.dto.NewsDtos.NewsArticleResponse;
import com.politikapp.backend.news.dto.NewsDtos.RejectArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.ReviewArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.SourceResponse;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.entity.NewsAuditLog;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import com.politikapp.backend.news.repository.NewsAuditLogRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminNewsService {
    private final NewsArticleRepository articleRepository;
    private final GovernmentSourceRepository sourceRepository;
    private final NewsAuditLogRepository auditLogRepository;
    private final AuthUserRepository userRepository;
    private final NewsMapper mapper;
    private final NewsAiService aiService;

    public AdminNewsService(
            NewsArticleRepository articleRepository,
            GovernmentSourceRepository sourceRepository,
            NewsAuditLogRepository auditLogRepository,
            AuthUserRepository userRepository,
            NewsMapper mapper,
            NewsAiService aiService
    ) {
        this.articleRepository = articleRepository;
        this.sourceRepository = sourceRepository;
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.mapper = mapper;
        this.aiService = aiService;
    }

    @Transactional(readOnly = true)
    public Page<NewsArticleResponse> pending(Pageable pageable) {
        return articleRepository.findByStatus("PENDING_REVIEW", pageable)
                .map(article -> mapper.toArticleResponse(article, false));
    }

    @Transactional(readOnly = true)
    public Page<NewsArticleResponse> list(String status, Pageable pageable) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            return articleRepository.findAll(pageable).map(article -> mapper.toArticleResponse(article, false));
        }
        return articleRepository.findByStatus(status.trim().toUpperCase(), pageable)
                .map(article -> mapper.toArticleResponse(article, false));
    }

    @Transactional(readOnly = true)
    public AdminNewsSummaryResponse summary() {
        return new AdminNewsSummaryResponse(
                articleRepository.countByStatus("PENDING_REVIEW"),
                articleRepository.countByStatus("PUBLISHED"),
                articleRepository.countByStatus("REJECTED")
        );
    }

    @Transactional(readOnly = true)
    public NewsArticleResponse get(UUID id) {
        return mapper.toArticleResponse(article(id), false);
    }

    @Transactional(readOnly = true)
    public List<SourceResponse> sources() {
        return sourceRepository.findAll().stream().map(mapper::toSourceResponse).toList();
    }

    @Transactional
    public NewsArticleResponse processAi(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        aiService.processArticle(article);
        log(article, admin(adminId), "PROCESS_AI", "AI processing requested by admin.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse update(UUID id, ReviewArticleRequest request, UUID adminId) {
        NewsArticle article = article(id);
        article.setSuggestedTitle(request.suggestedTitle().trim());
        article.setAiSummary(request.aiSummary().trim());
        article.setCategory(request.category().trim());
        article.setReviewNotes(request.reviewNotes());
        article.setReviewedBy(admin(adminId));
        article.setReviewedAt(Instant.now());
        if ("RETRIEVED".equals(article.getStatus()) || "PROCESSING".equals(article.getStatus())) {
            article.setStatus("PENDING_REVIEW");
        }
        log(article, article.getReviewedBy(), "UPDATE", "Admin edited news article.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse approve(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        AuthUser admin = admin(adminId);
        article.setReviewedBy(admin);
        article.setReviewedAt(Instant.now());
        article.setStatus("APPROVED");
        log(article, admin, "APPROVE", "Article approved for publication.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse reject(UUID id, RejectArticleRequest request, UUID adminId) {
        NewsArticle article = article(id);
        AuthUser admin = admin(adminId);
        article.setReviewedBy(admin);
        article.setReviewedAt(Instant.now());
        article.setReviewNotes(request.reason());
        article.setStatus("REJECTED");
        log(article, admin, "REJECT", request.reason());
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse publish(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        if (!List.of("APPROVED", "PENDING_REVIEW", "UNPUBLISHED").contains(article.getStatus())) {
            throw new HttpResponseException(409, "Only reviewed articles can be published.");
        }
        AuthUser admin = admin(adminId);
        article.setReviewedBy(admin);
        article.setReviewedAt(article.getReviewedAt() == null ? Instant.now() : article.getReviewedAt());
        article.setPublishedAt(Instant.now());
        article.setStatus("PUBLISHED");
        log(article, admin, "PUBLISH", "Article published to public feed.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse unpublish(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        AuthUser admin = admin(adminId);
        article.setStatus("UNPUBLISHED");
        log(article, admin, "UNPUBLISH", "Article removed from public feed.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    private NewsArticle article(UUID id) {
        return articleRepository.findById(id).orElseThrow(() -> new HttpResponseException(404, "News article not found."));
    }

    private AuthUser admin(UUID adminId) {
        if (adminId == null) return null;
        return userRepository.findById(adminId).orElse(null);
    }

    private void log(NewsArticle article, AuthUser admin, String action, String details) {
        NewsAuditLog log = new NewsAuditLog();
        log.setArticle(article);
        log.setAdmin(admin);
        log.setAction(action);
        log.setChangeDetails(details);
        auditLogRepository.save(log);
    }
}
