package com.politikapp.backend.module3.repository;

import com.politikapp.backend.module3.entity.JuryVoteTrustRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JuryVoteTrustRecordRepository extends JpaRepository<JuryVoteTrustRecord, UUID> {
    List<JuryVoteTrustRecord> findByPeerId(UUID peerId);
    List<JuryVoteTrustRecord> findByQueueId(UUID queueId);
}
