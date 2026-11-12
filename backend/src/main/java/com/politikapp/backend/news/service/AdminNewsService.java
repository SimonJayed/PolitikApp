package com.politikapp.backend.news.service;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.news.dto.NewsDtos.AdminNewsSummaryResponse;
import com.politikapp.backend.news.dto.NewsDtos.NewsArticleResponse;
import com.politikapp.backend.news.dto.NewsDtos.RejectArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.ReviewArticleRequest;
import com.politikapp.backend.news.dto.NewsDtos.SourceResponse;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.entity.NewsAuditLog;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import com.politikapp.backend.news.repository.NewsAuditLogRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AdminNewsService {
    private final NewsArticleRepository articleRepository;
    private final GovernmentSourceRepository sourceRepository;
    private final NewsAuditLogRepository auditLogRepository;
    private final AuthUserRepository userRepository;
    private final NewsMapper mapper;
    private final NewsAiService aiService;
    private final ApprovedSourceClient sourceClient;
    private final com.politikapp.backend.politician.repository.PoliticianRepository politicians;
    private final TransactionTemplate readTx;
    private final TransactionTemplate writeTx;

    public AdminNewsService(
            NewsArticleRepository articleRepository,
            GovernmentSourceRepository sourceRepository,
            NewsAuditLogRepository auditLogRepository,
            AuthUserRepository userRepository,
            NewsMapper mapper,
            NewsAiService aiService,
            ApprovedSourceClient sourceClient,
            com.politikapp.backend.politician.repository.PoliticianRepository politicians
    ) {
        this(articleRepository, sourceRepository, auditLogRepository, userRepository,
                mapper, aiService, sourceClient, politicians, null);
    }

    @Autowired
    public AdminNewsService(
            NewsArticleRepository articleRepository,
            GovernmentSourceRepository sourceRepository,
            NewsAuditLogRepository auditLogRepository,
            AuthUserRepository userRepository,
            NewsMapper mapper,
            NewsAiService aiService,
            ApprovedSourceClient sourceClient,
            com.politikapp.backend.politician.repository.PoliticianRepository politicians,
            PlatformTransactionManager transactionManager
    ) {
        this.articleRepository = articleRepository;
        this.sourceRepository = sourceRepository;
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.mapper = mapper;
        this.aiService = aiService;
        this.sourceClient = sourceClient;
        this.politicians = politicians;
        if (transactionManager == null) {
            this.readTx = null;
            this.writeTx = null;
        } else {
            this.readTx = new TransactionTemplate(transactionManager);
            this.readTx.setReadOnly(true);
            this.writeTx = new TransactionTemplate(transactionManager);
            this.writeTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        }
    }

    @Transactional(readOnly = true)
    public Page<NewsArticleResponse> pending(Pageable pageable) {
        return mapper.toArticlePage(articleRepository.findByStatus("PENDING_REVIEW", pageable), java.util.Set.of(), true);
    }

    @Transactional(readOnly = true)
    public Page<NewsArticleResponse> list(String status, Pageable pageable) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            return mapper.toArticlePage(articleRepository.findAll(pageable), java.util.Set.of(), true);
        }
        return mapper.toArticlePage(articleRepository.findByStatus(status.trim().toUpperCase(), pageable), java.util.Set.of(), true);
    }

    @Transactional(readOnly = true)
    public AdminNewsSummaryResponse summary() {
        var counts = articleRepository.countByStatusGrouped().stream().collect(java.util.stream.Collectors.toMap(
                NewsArticleRepository.StatusCount::getStatus, NewsArticleRepository.StatusCount::getTotal));
        return new AdminNewsSummaryResponse(
                counts.getOrDefault("PENDING_REVIEW", 0L),
                counts.getOrDefault("PUBLISHED", 0L),
                counts.getOrDefault("REJECTED", 0L)
        );
    }

    @Transactional(readOnly = true)
    public NewsArticleResponse get(UUID id) {
        return mapper.toArticleResponse(articleRepository.findById(id)
                .orElseThrow(() -> new HttpResponseException(404, "News article not found.")), false);
    }

    @Transactional(readOnly = true)
    public List<SourceResponse> sources() {
        return sourceRepository.findAll().stream().filter(source -> !GovernmentNewsSourcePolicy.removed(source))
                .map(mapper::toSourceResponse).toList();
    }

    public NewsArticleResponse processAi(UUID id, UUID adminId) {
        // Prepare a detached snapshot in a short read transaction so the external Gemini call
        // never holds a Postgres row lock or Hikari connection.
        NewsArticle workingCopy = inTransaction(readTx, () -> {
            admin(adminId);
            NewsArticle existing = articleRepository.findById(id)
                    .orElseThrow(() -> new HttpResponseException(404, "News article not found."));
            requireAiEligible(existing);
            return snapshotForAi(existing);
        });

        aiService.processArticle(workingCopy);

        return inTransaction(writeTx, () -> {
            AuthUser actor = admin(adminId);
            NewsArticle article = article(id);
            requireAiEligible(article);
            applyAiOutcome(article, workingCopy);
            log(article, actor, "PROCESS_AI", "AI processing requested by admin; result=" + article.getAiProcessingStatus());
            return mapper.toArticleResponse(articleRepository.save(article), false);
        });
    }

    private void requireAiEligible(NewsArticle article) {
        requireStatus(article, "PENDING_REVIEW", "REJECTED", "APPROVED", "UNPUBLISHED");
        if ("INCOMPLETE".equals(article.getAiProcessingStatus())) {
            throw new HttpResponseException(409, "Full article text is unavailable; AI processing is not permitted for metadata-only records.");
        }
        if (article.getOriginalContent() == null || article.getOriginalContent().isBlank()) {
            throw new HttpResponseException(409, "Full source text is required before AI processing.");
        }
    }

    private NewsArticle snapshotForAi(NewsArticle source) {
        NewsArticle copy = new NewsArticle();
        copy.setId(source.getId());
        if (source.getSource() != null) {
            GovernmentSource detachedSource = new GovernmentSource();
            detachedSource.setId(source.getSource().getId());
            detachedSource.setName(source.getSource().getName());
            copy.setSource(detachedSource);
        }
        copy.setOriginalTitle(source.getOriginalTitle());
        copy.setSuggestedTitle(source.getSuggestedTitle());
        copy.setSourceUrl(source.getSourceUrl());
        copy.setCanonicalUrl(source.getCanonicalUrl());
        copy.setOriginalContent(source.getOriginalContent());
        copy.setAiSummary(source.getAiSummary());
        copy.setAiKeyPoints(source.getAiKeyPoints());
        copy.setCategory(source.getCategory());
        copy.setOriginalPublishedAt(source.getOriginalPublishedAt());
        copy.setStatus(source.getStatus());
        copy.setAiProcessingStatus(source.getAiProcessingStatus());
        copy.setExtractionData(source.getExtractionData());
        copy.setReviewNotes(source.getReviewNotes());
        return copy;
    }

    private void applyAiOutcome(NewsArticle article, NewsArticle workingCopy) {
        boolean failed = "FAILED".equals(workingCopy.getAiProcessingStatus());
        boolean hadSummary = article.getAiSummary() != null && !article.getAiSummary().isBlank();
        article.setAiModel(workingCopy.getAiModel());
        article.setAiProcessingStatus(workingCopy.getAiProcessingStatus());
        article.setAiProcessedAt(workingCopy.getAiProcessedAt());
        article.setAiProcessingMs(workingCopy.getAiProcessingMs());

        if (failed && hadSummary) {
            article.setReviewNotes(mergeFailureReviewNotes(workingCopy.getReviewNotes(), article.getReviewNotes()));
            return;
        }
        if (failed) {
            article.setSuggestedTitle(workingCopy.getSuggestedTitle());
            article.setAiSummary(workingCopy.getAiSummary());
            article.setAiKeyPoints(workingCopy.getAiKeyPoints());
            article.setExtractionData(null);
            article.getRelatedPoliticians().clear();
            article.setReviewNotes(workingCopy.getReviewNotes());
            invalidateApproval(article);
            return;
        }

        invalidateApproval(article);
        article.setExtractionData(workingCopy.getExtractionData());
        article.getRelatedPoliticians().clear();
        for (var politician : workingCopy.getRelatedPoliticians()) {
            article.getRelatedPoliticians().add(politicians.getReferenceById(politician.getPoliticianId()));
        }
        article.setSuggestedTitle(workingCopy.getSuggestedTitle());
        article.setAiSummary(workingCopy.getAiSummary());
        article.setAiKeyPoints(workingCopy.getAiKeyPoints());
        article.setCategory(workingCopy.getCategory());
        article.setReviewNotes(workingCopy.getReviewNotes());
        article.setStatus(workingCopy.getStatus());
    }

    private String mergeFailureReviewNotes(String failureNote, String previousNotes) {
        if (previousNotes == null || previousNotes.isBlank()) return failureNote;
        String base = failureNote == null ? "" : failureNote.trim();
        String trimmedPrev = previousNotes.trim();
        int prevMarker = trimmedPrev.indexOf("\nPrevious notes: ");
        if (prevMarker >= 0) {
            trimmedPrev = trimmedPrev.substring(prevMarker + "\nPrevious notes: ".length()).trim();
        } else if (trimmedPrev.startsWith("AI processing failed")) {
            return base;
        }
        if (trimmedPrev.isBlank()) return base;
        String combined = base + "\nPrevious notes: " + trimmedPrev;
        return combined.length() <= 3000 ? combined : combined.substring(0, 2997).trim() + "...";
    }

    private <T> T inTransaction(TransactionTemplate template, Supplier<T> action) {
        return template == null ? action.get() : template.execute(status -> action.get());
    }

    @Transactional
    public NewsArticleResponse update(UUID id, ReviewArticleRequest request, UUID adminId) {
        AuthUser actor = admin(adminId);
        NewsArticle article = article(id);
        requireStatus(article, "PENDING_REVIEW", "APPROVED", "REJECTED", "PUBLISHED", "UNPUBLISHED");
        if (!List.of("Legislation", "Government Projects", "Public Spending", "Audit Reports", "Government Announcements").contains(request.category())) {
            throw new HttpResponseException(400, "Unsupported article category.");
        }
        if (request.relatedPoliticianIds() != null) {
            var ids = new java.util.HashSet<>(request.relatedPoliticianIds());
            var related = politicians.findAllById(ids);
            if (related.size() != ids.size()) throw new HttpResponseException(400, "Related politician not found.");
            article.setRelatedPoliticians(new java.util.LinkedHashSet<>(related));
        }
        article.setSuggestedTitle(request.suggestedTitle().trim());
        article.setAiSummary(request.aiSummary().trim());
        if (request.keyPoints() != null) article.setAiKeyPoints(String.join("\n", request.keyPoints()));
        article.setCategory(request.category().trim());
        article.setReviewNotes(request.reviewNotes());
        invalidateApproval(article);
        log(article, actor, "UPDATE", "Admin edited news article; fresh approval required.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse approve(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        if ("INCOMPLETE".equals(article.getAiProcessingStatus())) {
            throw new HttpResponseException(409, "Metadata-only article cannot be approved without verified full text.");
        }
        if (!"PENDING_REVIEW".equals(article.getStatus())) {
            throw new HttpResponseException(409, "Only pending articles can be approved.");
        }
        if (article.getAiSummary() == null || article.getAiSummary().isBlank()) {
            throw new HttpResponseException(409, "Provide a reviewed summary before approval.");
        }
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
        requireStatus(article, "PENDING_REVIEW", "APPROVED");
        AuthUser admin = admin(adminId);
        article.setReviewedBy(admin);
        article.setReviewedAt(Instant.now());
        article.setReviewNotes(request.reason());
        article.setStatus("REJECTED");
        article.setPublishedAt(null);
        log(article, admin, "REJECT", request.reason());
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse publish(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        if ("INCOMPLETE".equals(article.getAiProcessingStatus())) {
            throw new HttpResponseException(409, "Metadata-only article cannot be published.");
        }
        if (!List.of("APPROVED", "UNPUBLISHED").contains(article.getStatus())
                || article.getReviewedAt() == null || article.getReviewedBy() == null) {
            throw new HttpResponseException(409, "Only reviewed articles can be published.");
        }
        AuthUser admin = admin(adminId);
        article.setReviewedAt(article.getReviewedAt() == null ? Instant.now() : article.getReviewedAt());
        article.setPublishedAt(Instant.now());
        article.setStatus("PUBLISHED");
        log(article, admin, "PUBLISH", "Article published to public feed.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    @Transactional
    public NewsArticleResponse unpublish(UUID id, UUID adminId) {
        NewsArticle article = article(id);
        if (!"PUBLISHED".equals(article.getStatus())) {
            throw new HttpResponseException(409, "Only published articles can be unpublished.");
        }
        AuthUser admin = admin(adminId);
        article.setStatus("UNPUBLISHED");
        article.setPublishedAt(null);
        log(article, admin, "UNPUBLISH", "Article removed from public feed.");
        return mapper.toArticleResponse(articleRepository.save(article), false);
    }

    private NewsArticle article(UUID id) {
        return articleRepository.findForReview(id).orElseThrow(() -> new HttpResponseException(404, "News article not found."));
    }

    private void requireStatus(NewsArticle article, String... allowed) {
        if (!List.of(allowed).contains(article.getStatus())) {
            throw new HttpResponseException(409, "This action is not permitted for the current article status.");
        }
    }

    @Transactional
    public SourceResponse saveSource(UUID id, com.politikapp.backend.news.dto.NewsDtos.SourceRequest request, UUID adminId) {
        AuthUser actor = admin(adminId);
        var source = id == null ? new com.politikapp.backend.news.entity.GovernmentSource()
                : sourceRepository.findById(id).orElseThrow(() -> new HttpResponseException(404, "Source not found."));
        source.setName(request.name().trim());
        source.setBaseUrl(request.baseUrl().trim());
        source.setFeedUrl(request.feedUrl() == null || request.feedUrl().isBlank() ? null : request.feedUrl().trim());
        source.setRetrievalType(request.retrievalType());
        if (GovernmentNewsSourcePolicy.removed(source)) {
            throw new HttpResponseException(400, "This source has been removed from government news retrieval.");
        }
        try {
            sourceClient.validate(source, java.net.URI.create(source.getBaseUrl()));
            if (source.getFeedUrl() != null) sourceClient.validate(source, java.net.URI.create(source.getFeedUrl()));
        } catch (IllegalArgumentException exception) {
            throw new HttpResponseException(400, "Source URLs must use HTTPS and a host explicitly approved in backend configuration.");
        }
        source.setActive(request.active());
        sourceRepository.save(source);
        log(null, actor, "UPDATE_SOURCE", "Source " + source.getId() + " saved; active=" + source.isActive());
        return mapper.toSourceResponse(source);
    }

    private AuthUser admin(UUID adminId) {
        if (adminId == null) throw new HttpResponseException(401, "Authentication required.");
        AuthUser user = userRepository.findById(adminId)
                .orElseThrow(() -> new HttpResponseException(401, "Account not found."));
        if (!"ADMIN".equals(user.getRole()) || !"ACTIVE".equals(user.getAccountStatus())) {
            throw new HttpResponseException(403, "Active administrator access required.");
        }
        return user;
    }

    private void invalidateApproval(NewsArticle article) {
        article.setStatus("PENDING_REVIEW");
        article.setReviewedBy(null);
        article.setReviewedAt(null);
        article.setPublishedAt(null);
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
