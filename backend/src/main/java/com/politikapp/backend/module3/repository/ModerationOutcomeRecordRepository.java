package com.politikapp.backend.module3.repository;

import com.politikapp.backend.module3.entity.ModerationOutcomeRecord;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationOutcomeRecordRepository extends JpaRepository<ModerationOutcomeRecord, UUID> {
}
