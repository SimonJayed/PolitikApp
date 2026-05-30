package com.politikapp.backend.module2.repository;

import com.politikapp.backend.module2.entity.JuryVote;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JuryVoteRepository extends JpaRepository<JuryVote, UUID> {
    List<JuryVote> findByQueueIdAndVoteType(UUID queueId, String voteType);
    boolean existsByQueueIdAndPeerId(UUID queueId, UUID peerId);
}
