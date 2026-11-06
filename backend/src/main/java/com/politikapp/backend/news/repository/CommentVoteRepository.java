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
            select count(v)
            from CommentVote v
            where v.comment.id = :commentId and v.voteType = :voteType
            """)
    int countByCommentIdAndVoteType(@Param("commentId") UUID commentId, @Param("voteType") String voteType);

    default int scoreForComment(UUID commentId) {
        return countByCommentIdAndVoteType(commentId, "UP") - countByCommentIdAndVoteType(commentId, "DOWN");
    }
}
