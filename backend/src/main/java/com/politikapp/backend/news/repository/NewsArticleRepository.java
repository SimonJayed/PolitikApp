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
    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "source")
    Page<NewsArticle> findAll(Pageable pageable);

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "source")
    Page<NewsArticle> findAll(org.springframework.data.jpa.domain.Specification<NewsArticle> specification, Pageable pageable);

    interface StatusCount {
        String getStatus();
        long getTotal();
    }

    @Query("select a.status as status, count(a) as total from NewsArticle a group by a.status")
    java.util.List<StatusCount> countByStatusGrouped();

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from NewsArticle a where a.id = :id")
    Optional<NewsArticle> findForReview(@Param("id") UUID id);

    boolean existsByCanonicalUrl(String canonicalUrl);

    long countByStatus(String status);

    @Query("select article from NewsArticle article where article.id = :id and article.status = :status "
            + "and (:status <> 'PUBLISHED' or (article.reviewedBy is not null and article.reviewedAt is not null and article.publishedAt is not null))")
    Optional<NewsArticle> findByIdAndStatus(@Param("id") UUID id, @Param("status") String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "source")
    Page<NewsArticle> findByStatus(String status, Pageable pageable);

    @Query("select count(article) from NewsArticle article where article.status = :status and article.reviewedBy is not null and article.reviewedAt is not null and article.publishedAt >= :publishedAt")
    long countPublishedSince(@Param("status") String status, @Param("publishedAt") Instant publishedAt);

    @Query("select count(article) from NewsArticle article where article.status = :status and article.reviewedBy is not null and article.reviewedAt is not null and article.publishedAt is not null and article.category in :categories")
    long countByPublishedCategories(@Param("status") String status, @Param("categories") java.util.Collection<String> categories);
}
