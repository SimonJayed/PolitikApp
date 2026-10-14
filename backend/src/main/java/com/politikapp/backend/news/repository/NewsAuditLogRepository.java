package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.NewsAuditLog;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsAuditLogRepository extends JpaRepository<NewsAuditLog, UUID> {
}
