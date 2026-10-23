package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.NewsArticle;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NewsArticleRepository extends JpaRepository<NewsArticle, UUID>, JpaSpecificationExecutor<NewsArticle> {
    boolean existsByCanonicalUrl(String canonicalUrl);

    long countByStatus(String status);

    Optional<NewsArticle> findByIdAndStatus(UUID id, String status);

    Page<NewsArticle> findByStatus(String status, Pageable pageable);

    @Query("select count(article) from NewsArticle article where article.status = :status and article.publishedAt >= :publishedAt")
    long countPublishedSince(@Param("status") String status, @Param("publishedAt") Instant publishedAt);

    @Query("select count(article) from NewsArticle article where article.status = :status and article.category in :categories")
    long countByPublishedCategories(@Param("status") String status, @Param("categories") java.util.Collection<String> categories);
}
