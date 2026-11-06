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
    List<NewsComment> findByArticleIdAndHiddenFalseAndDeletedAtIsNull(UUID articleId, Sort sort);
    long countByArticleIdAndHiddenFalseAndDeletedAtIsNull(UUID articleId);

    List<NewsComment> findByUserUserIdAndHiddenFalseAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    @Query("select count(comment) from NewsComment comment join comment.article article where article.status = :status and comment.hidden = false and comment.deletedAt is null and comment.createdAt >= :createdAt")
    long countPublishedSince(@Param("status") String status, @Param("createdAt") Instant createdAt);
}
