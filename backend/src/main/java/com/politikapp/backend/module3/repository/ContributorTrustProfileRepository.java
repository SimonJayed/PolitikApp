package com.politikapp.backend.module3.repository;

import com.politikapp.backend.module3.entity.ContributorTrustProfile;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContributorTrustProfileRepository extends JpaRepository<ContributorTrustProfile, UUID> {
}
