package com.politikapp.backend.module3.repository;

import com.politikapp.backend.module3.entity.PeerApplication;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PeerApplicationRepository extends JpaRepository<PeerApplication, UUID> {
    List<PeerApplication> findByStatus(String status);
    List<PeerApplication> findByContributorId(UUID contributorId);
}
