package com.politikapp.backend.news.service;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.news.dto.NewsDtos.CreateCommentRequest;
import com.politikapp.backend.news.dto.NewsDtos.NewsArticleResponse;
import com.politikapp.backend.news.dto.NewsDtos.NewsCommentResponse;
import com.politikapp.backend.news.dto.NewsDtos.UserCommentResponse;
import com.politikapp.backend.news.dto.NewsDtos.DashboardSummaryResponse;
import com.politikapp.backend.news.dto.NewsDtos.VoteRequest;
import com.politikapp.backend.news.entity.CommentVote;
import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.entity.NewsComment;
import com.politikapp.backend.news.entity.SavedPost;
import com.politikapp.backend.news.repository.CommentVoteRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import com.politikapp.backend.news.repository.NewsCommentRepository;
import com.politikapp.backend.news.repository.SavedPostRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Set;
import jakarta.persistence.criteria.Expression;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NewsService {
    private final NewsArticleRepository articleRepository;
    private final NewsCommentRepository commentRepository;
    private final CommentVoteRepository voteRepository;
    private final SavedPostRepository savedPostRepository;
    private final AuthUserRepository userRepository;
    private final NewsMapper mapper;

    public NewsService(
            NewsArticleRepository articleRepository,
            NewsCommentRepository commentRepository,
            CommentVoteRepository voteRepository,
            SavedPostRepository savedPostRepository,
            AuthUserRepository userRepository,
            NewsMapper mapper
    ) {
        this.articleRepository = articleRepository;
        this.commentRepository = commentRepository;
        this.voteRepository = voteRepository;
        this.savedPostRepository = savedPostRepository;
        this.userRepository = userRepository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Page<NewsArticleResponse> published(String category, String query, Pageable pageable, UUID userId) {
        return published(category, query, pageable, userId, true);
    }

    @Transactional(readOnly = true)
    public Page<NewsArticleResponse> published(String category, String query, Pageable pageable, UUID userId, boolean includeOriginal) {
        String normalizedCategory = category == null || category.equalsIgnoreCase("All") || category.equalsIgnoreCase("Latest") || category.isBlank() ? null : category;
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        var articles = articleRepository.findAll(publishedSpec(normalizedCategory, normalizedQuery), pageable);
        var savedIds = userId == null || articles.isEmpty() ? Set.<UUID>of()
                : savedPostRepository.findSavedArticleIds(userId, articles.getContent().stream().map(NewsArticle::getId).toList());
        return mapper.toArticlePage(articles, savedIds, false, includeOriginal);
    }

    @Transactional(readOnly = true)
    public NewsArticleResponse publishedById(UUID id, UUID userId) {
        NewsArticle article = requirePublicArticle(id);
        return mapper.toArticleResponse(article, isSaved(userId, article.getId()), false);
    }

    @Transactional(readOnly = true)
    public OriginalArticleService.StoredOriginal originalSnapshot(UUID id) {
        var article = requirePublicArticle(id);
        return new OriginalArticleService.StoredOriginal(article.getSourceUrl(), article.getSource().getBaseUrl(),
                article.getOriginalContent(), article.getExtractionData());
    }

    public List<String> categories() {
        return List.of("All", "Latest", "Legislation", "Government Projects", "Public Spending", "Audit Reports", "Government Announcements");
    }

    @Transactional(readOnly = true)
    public List<NewsCommentResponse> comments(UUID articleId, UUID userId) {
        requirePublicArticle(articleId);
        return commentRepository.findByArticleIdAndHiddenFalseAndDeletedAtIsNull(articleId, Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(comment -> mapper.toCommentResponse(comment, userId))
                .toList();
    }

    @Transactional
    public NewsCommentResponse addComment(UUID articleId, CreateCommentRequest request, UUID userId) {
        NewsArticle article = requirePublicArticle(articleId);
        AuthUser user = user(userId);
        NewsComment comment = new NewsComment();
        comment.setArticle(article);
        comment.setUser(user);
        comment.setContent(sanitize(request.content()));
        return mapper.toCommentResponse(commentRepository.save(comment));
    }

    @Transactional
    public NewsCommentResponse vote(UUID commentId, VoteRequest request, UUID userId) {
        String voteType = request.voteType().trim().toUpperCase();
        if (!List.of("UP", "DOWN").contains(voteType)) {
            throw new HttpResponseException(400, "voteType must be UP or DOWN.");
        }
        AuthUser user = user(userId);
        NewsComment comment = commentRepository.lockById(commentId)
                .orElseThrow(() -> new HttpResponseException(404, "Comment not found."));
        if (comment.isHidden() || comment.getDeletedAt() != null || !publicArticle(comment.getArticle())) {
            throw new HttpResponseException(409, "This comment cannot be voted on.");
        }
        CommentVote vote = voteRepository.findByCommentIdAndUserUserId(commentId, userId).orElse(null);
        boolean selected = vote != null && voteType.equals(vote.getVoteType());
        if (request.active() == null && vote != null && !selected) {
            throw new HttpResponseException(409, "Take back the current vote before switching.");
        }
        boolean active = request.active() == null ? !selected : request.active();
        if (active) {
            if (vote == null) {
                vote = new CommentVote();
                vote.setComment(comment);
                vote.setUser(user);
            }
            vote.setVoteType(voteType);
            voteRepository.save(vote);
        } else if (selected) {
            voteRepository.delete(vote);
        }
        voteRepository.flush();
        return mapper.toCommentResponse(comment, userId);
    }

    @Transactional
    public void savePost(UUID articleId, UUID userId) {
        lockUser(userId);
        NewsArticle article = requirePublicArticle(articleId);
        if (!savedPostRepository.existsByIdUserIdAndIdNewsId(userId, articleId)) {
            savedPostRepository.save(new SavedPost(userId, article));
        }
    }

    @Transactional
    public void unsavePost(UUID articleId, UUID userId) {
        lockUser(userId);
        savedPostRepository.deleteByIdUserIdAndIdNewsId(userId, articleId);
    }

    @Transactional(readOnly = true)
    public List<UserCommentResponse> userComments(UUID userId) {
            if (userId == null) throw new HttpResponseException(401, "Authentication required.");
            return commentRepository.findByUserUserIdAndHiddenFalseAndDeletedAtIsNullOrderByCreatedAtDesc(userId).stream()
                    .filter(comment -> publicArticle(comment.getArticle()))
                    .map(comment -> new UserCommentResponse(
                            comment.getId(),
                            comment.getArticle().getId(),
                            comment.getArticle().getSuggestedTitle() != null
                                    ? comment.getArticle().getSuggestedTitle()
                                    : comment.getArticle().getOriginalTitle(),
                            comment.getContent(),
                            comment.getCreatedAt(),
                            voteRepository.scoreForComment(comment.getId())
                    ))
                    .toList();
    }

    @Transactional(readOnly = true)
    public List<NewsArticleResponse> savedPosts(UUID userId) {
            if (userId == null) throw new HttpResponseException(401, "Authentication required.");
            return savedPostRepository.findByIdUserIdOrderByCreatedAtDesc(userId).stream()
                    .map(saved -> saved.getArticle())
                    .filter(this::publicArticle)
                    .map(article -> mapper.toArticleResponse(article, true, false))
                    .toList();
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary(Instant fourteenDaysAgo, Instant weekStart) {
            long records = articleRepository.count(publishedSpec("Legislation", null))
                    + articleRepository.count(publishedSpec("Audit Reports", null));
            return new DashboardSummaryResponse(
                    records,
                    articleRepository.countPublishedSince("PUBLISHED", fourteenDaysAgo),
                    commentRepository.countPublishedSince("PUBLISHED", weekStart)
            );
    }

    private NewsArticle requirePublicArticle(UUID articleId) {
        return articleRepository.findByIdAndStatus(articleId, "PUBLISHED").filter(this::publicArticle)
                .orElseThrow(() -> new HttpResponseException(404, "Published news article not found."));
    }

    private void lockUser(UUID userId) {
        if (userId == null || userRepository.lockById(userId).isEmpty()) {
            throw new HttpResponseException(401, "Authentication required.");
        }
    }

    private AuthUser user(UUID userId) {
        if (userId == null) throw new HttpResponseException(401, "Authentication required.");
        return userRepository.findById(userId).orElseThrow(() -> new HttpResponseException(401, "Authenticated user not found."));
    }

    private boolean isSaved(UUID userId, UUID articleId) {
        return userId != null && savedPostRepository.existsByIdUserIdAndIdNewsId(userId, articleId);
    }

    private boolean publicArticle(NewsArticle article) {
        return "PUBLISHED".equals(article.getStatus()) && article.getReviewedBy() != null
                && article.getReviewedAt() != null && article.getPublishedAt() != null;
    }

    private String sanitize(String content) {
        return content.strip(); // React renders comments as text, never HTML.
    }

    private Specification<NewsArticle> publishedSpec(String category, String query) {
        return (root, criteriaQuery, builder) -> {
            var predicate = builder.equal(root.get("status"), "PUBLISHED");
            predicate = builder.and(predicate, builder.isNotNull(root.get("reviewedBy")),
                    builder.isNotNull(root.get("reviewedAt")), builder.isNotNull(root.get("publishedAt")));
            if (category != null) {
                String topic = categories().stream().filter(value -> value.equalsIgnoreCase(category.trim()))
                        .findFirst().orElse(category.trim());
                predicate = builder.and(predicate, builder.equal(root.get("automaticTopic"), topic));
            }
            if (query != null) {
                String like = "%" + query.toLowerCase(java.util.Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                Expression<String> headline = builder.lower(builder.coalesce(root.get("suggestedTitle"), root.get("originalTitle")));
                Expression<String> body = builder.lower(builder.coalesce(root.get("aiSummary"), root.get("originalContent")));
                predicate = builder.and(predicate, builder.or(builder.like(headline, like, '\\'), builder.like(body, like, '\\')));
            }
            return predicate;
        };
    }
}
