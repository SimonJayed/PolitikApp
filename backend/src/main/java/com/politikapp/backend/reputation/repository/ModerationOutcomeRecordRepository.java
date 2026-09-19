package com.politikapp.backend.reputation.repository;

import com.politikapp.backend.reputation.entity.ModerationOutcomeRecord;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationOutcomeRecordRepository extends JpaRepository<ModerationOutcomeRecord, UUID> {
}
