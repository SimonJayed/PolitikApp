package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.SavedPost;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedPostRepository extends JpaRepository<SavedPost, SavedPost.SavedPostId> {
    boolean existsByIdUserIdAndIdNewsId(UUID userId, UUID newsId);

    List<SavedPost> findByIdUserIdOrderByCreatedAtDesc(UUID userId);
}
