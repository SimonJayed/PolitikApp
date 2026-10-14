package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.NewsComment;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NewsCommentRepository extends JpaRepository<NewsComment, UUID> {
    List<NewsComment> findByArticleIdAndHiddenFalseAndDeletedAtIsNull(UUID articleId, Sort sort);
    long countByArticleIdAndHiddenFalseAndDeletedAtIsNull(UUID articleId);
}
