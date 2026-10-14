package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.CommentVote;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentVoteRepository extends JpaRepository<CommentVote, UUID> {
    Optional<CommentVote> findByCommentIdAndUserUserId(UUID commentId, UUID userId);

    @Query("""
            select coalesce(sum(case when v.voteType = 'UP' then 1 when v.voteType = 'DOWN' then -1 else 0 end), 0)
            from CommentVote v
            where v.comment.id = :commentId
            """)
    int scoreForComment(@Param("commentId") UUID commentId);
}
