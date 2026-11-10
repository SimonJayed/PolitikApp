package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.NewsComment;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.time.Instant;

public interface NewsCommentRepository extends JpaRepository<NewsComment, UUID> {
    interface ArticleCommentCount {
        UUID getArticleId();
        long getTotal();
    }

    @Query("select c.article.id as articleId, count(c) as total from NewsComment c "
            + "where c.article.id in :articleIds and c.hidden = false and c.deletedAt is null group by c.article.id")
    List<ArticleCommentCount> countVisibleByArticleIds(@Param("articleIds") java.util.Collection<UUID> articleIds);

    List<NewsComment> findByArticleIdAndHiddenFalseAndDeletedAtIsNull(UUID articleId, Sort sort);
    long countByArticleIdAndHiddenFalseAndDeletedAtIsNull(UUID articleId);

    List<NewsComment> findByUserUserIdAndHiddenFalseAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    @Query("select count(comment) from NewsComment comment join comment.article article where article.status = :status and article.reviewedBy is not null and article.reviewedAt is not null and article.publishedAt is not null and comment.hidden = false and comment.deletedAt is null and comment.createdAt >= :createdAt")
    long countPublishedSince(@Param("status") String status, @Param("createdAt") Instant createdAt);
}
