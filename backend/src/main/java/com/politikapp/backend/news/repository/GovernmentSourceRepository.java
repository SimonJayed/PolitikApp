package com.politikapp.backend.news.repository;

import com.politikapp.backend.news.entity.GovernmentSource;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GovernmentSourceRepository extends JpaRepository<GovernmentSource, UUID> {
    List<GovernmentSource> findByActiveTrue();
}
