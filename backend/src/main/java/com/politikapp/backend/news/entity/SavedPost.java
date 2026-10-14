package com.politikapp.backend.news.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "saved_posts")
@Getter
@Setter
@NoArgsConstructor
public class SavedPost {
    @EmbeddedId
    private SavedPostId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("newsId")
    @JoinColumn(name = "news_id", nullable = false)
    private NewsArticle article;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public SavedPost(UUID userId, NewsArticle article) {
        this.id = new SavedPostId(userId, article.getId());
        this.article = article;
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    public static class SavedPostId implements Serializable {
        @Column(name = "user_id")
        private UUID userId;

        @Column(name = "news_id")
        private UUID newsId;

        public SavedPostId(UUID userId, UUID newsId) {
            this.userId = userId;
            this.newsId = newsId;
        }
    }
}
