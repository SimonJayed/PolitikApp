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
        String normalizedCategory = category == null || category.equalsIgnoreCase("All") || category.isBlank() ? null : category;
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        return articleRepository.findAll(publishedSpec(normalizedCategory, normalizedQuery), pageable)
                .map(article -> mapper.toArticleResponse(article, isSaved(userId, article.getId())));
    }

    @Transactional(readOnly = true)
    public NewsArticleResponse publishedById(UUID id, UUID userId) {
        NewsArticle article = articleRepository.findByIdAndStatus(id, "PUBLISHED")
                .orElseThrow(() -> new HttpResponseException(404, "Published news article not found."));
        return mapper.toArticleResponse(article, isSaved(userId, article.getId()));
    }

    public List<String> categories() {
        return List.of("All", "Latest", "Legislation", "Government Projects", "Public Spending", "Audit Reports", "Government Announcements");
    }

    @Transactional(readOnly = true)
    public List<NewsCommentResponse> comments(UUID articleId) {
        articleRepository.findByIdAndStatus(articleId, "PUBLISHED")
                .orElseThrow(() -> new HttpResponseException(404, "Published news article not found."));
        return commentRepository.findByArticleIdAndHiddenFalseAndDeletedAtIsNull(articleId, Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(mapper::toCommentResponse)
                .toList();
    }

    @Transactional
    public NewsCommentResponse addComment(UUID articleId, CreateCommentRequest request, UUID userId) {
        NewsArticle article = articleRepository.findByIdAndStatus(articleId, "PUBLISHED")
                .orElseThrow(() -> new HttpResponseException(404, "Published news article not found."));
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
        NewsComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new HttpResponseException(404, "Comment not found."));
        if (comment.isHidden() || comment.getDeletedAt() != null || !"PUBLISHED".equals(comment.getArticle().getStatus())) {
            throw new HttpResponseException(409, "This comment cannot be voted on.");
        }
        AuthUser user = user(userId);
        CommentVote vote = voteRepository.findByCommentIdAndUserUserId(commentId, userId).orElse(null);
        if (vote != null && voteType.equals(vote.getVoteType())) {
            voteRepository.delete(vote);
            return mapper.toCommentResponse(comment);
        }
        if (vote == null) {
            vote = new CommentVote();
            vote.setComment(comment);
            vote.setUser(user);
        }
        vote.setVoteType(voteType);
        voteRepository.save(vote);
        return mapper.toCommentResponse(comment);
    }

    @Transactional
    public void savePost(UUID articleId, UUID userId) {
        NewsArticle article = articleRepository.findByIdAndStatus(articleId, "PUBLISHED")
                .orElseThrow(() -> new HttpResponseException(404, "Published news article not found."));
        if (!savedPostRepository.existsByIdUserIdAndIdNewsId(userId, articleId)) {
            savedPostRepository.save(new SavedPost(userId, article));
        }
    }

    @Transactional(readOnly = true)
    public List<UserCommentResponse> userComments(UUID userId) {
            if (userId == null) throw new HttpResponseException(401, "Authentication required.");
            return commentRepository.findByUserUserIdAndHiddenFalseAndDeletedAtIsNullOrderByCreatedAtDesc(userId).stream()
                    .filter(comment -> "PUBLISHED".equals(comment.getArticle().getStatus()))
                    .map(comment -> new UserCommentResponse(
                            comment.getId(),
                            comment.getArticle().getId(),
                            comment.getArticle().getSuggestedTitle() != null
                                    ? comment.getArticle().getSuggestedTitle()
                                    : comment.getArticle().getOriginalTitle(),
                            comment.getContent(),
                            comment.getCreatedAt(),
                            0
                    ))
                    .toList();
    }

    @Transactional(readOnly = true)
    public List<NewsArticleResponse> savedPosts(UUID userId) {
            if (userId == null) throw new HttpResponseException(401, "Authentication required.");
            return savedPostRepository.findByIdUserIdOrderByCreatedAtDesc(userId).stream()
                    .map(saved -> saved.getArticle())
                    .filter(article -> "PUBLISHED".equals(article.getStatus()))
                    .map(article -> mapper.toArticleResponse(article, true))
                    .toList();
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary(Instant fourteenDaysAgo, Instant weekStart) {
            long records = articleRepository.countByPublishedCategories(
                    "PUBLISHED",
                    Set.of("Legislation", "Bills", "Resolutions", "Audit Reports", "COA Audit Reports")
            );
            return new DashboardSummaryResponse(
                    records,
                    articleRepository.countPublishedSince("PUBLISHED", fourteenDaysAgo),
                    commentRepository.countPublishedSince("PUBLISHED", weekStart)
            );
    }

    private AuthUser user(UUID userId) {
        if (userId == null) throw new HttpResponseException(401, "Authentication required.");
        return userRepository.findById(userId).orElseThrow(() -> new HttpResponseException(401, "Authenticated user not found."));
    }

    private boolean isSaved(UUID userId, UUID articleId) {
        return userId != null && savedPostRepository.existsByIdUserIdAndIdNewsId(userId, articleId);
    }

    private String sanitize(String content) {
        return content.replace("<", "&lt;").replace(">", "&gt;").trim();
    }

    private Specification<NewsArticle> publishedSpec(String category, String query) {
        return (root, criteriaQuery, builder) -> {
            var predicate = builder.equal(root.get("status"), "PUBLISHED");
            if (category != null) {
                predicate = builder.and(predicate, builder.equal(builder.lower(root.get("category")), category.toLowerCase()));
            }
            if (query != null) {
                String like = "%" + query.toLowerCase() + "%";
                Expression<String> headline = builder.lower(builder.coalesce(root.get("suggestedTitle"), root.get("originalTitle")));
                Expression<String> body = builder.lower(builder.coalesce(root.get("aiSummary"), root.get("originalContent")));
                predicate = builder.and(predicate, builder.or(builder.like(headline, like), builder.like(body, like)));
            }
            return predicate;
        };
    }
}
