package com.politikapp.backend.reputation.repository;

import com.politikapp.backend.reputation.entity.ContributorTrustProfile;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContributorTrustProfileRepository extends JpaRepository<ContributorTrustProfile, UUID> {
}
