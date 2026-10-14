package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.NewsArticle;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface NewsArticleRepository extends JpaRepository<NewsArticle, UUID>, JpaSpecificationExecutor<NewsArticle> {
    boolean existsByCanonicalUrl(String canonicalUrl);

    long countByStatus(String status);

    Optional<NewsArticle> findByIdAndStatus(UUID id, String status);

    Page<NewsArticle> findByStatus(String status, Pageable pageable);
}
