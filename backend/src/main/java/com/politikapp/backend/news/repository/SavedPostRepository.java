package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.SavedPost;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedPostRepository extends JpaRepository<SavedPost, SavedPost.SavedPostId> {
    @org.springframework.data.jpa.repository.Query("select s.id.newsId from SavedPost s where s.id.userId = :userId and s.id.newsId in :articleIds")
    java.util.Set<UUID> findSavedArticleIds(@org.springframework.data.repository.query.Param("userId") UUID userId,
            @org.springframework.data.repository.query.Param("articleIds") java.util.Collection<UUID> articleIds);

    boolean existsByIdUserIdAndIdNewsId(UUID userId, UUID newsId);

    void deleteByIdUserIdAndIdNewsId(UUID userId, UUID newsId);

    List<SavedPost> findByIdUserIdOrderByCreatedAtDesc(UUID userId);
}
