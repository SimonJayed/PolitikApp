package com.politikapp.backend.accomplishment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccomplishmentRepository extends JpaRepository<Accomplishment, UUID> {
    List<Accomplishment> findByPoliticianIdOrderByCreatedAtDescAccomplishmentIdAsc(UUID politicianId);
    List<Accomplishment> findByPoliticianIdAndVisibleTrueOrderByCreatedAtDescAccomplishmentIdAsc(UUID politicianId);
    Optional<Accomplishment> findByAccomplishmentIdAndPoliticianId(UUID accomplishmentId, UUID politicianId);
    Optional<Accomplishment> findByAccomplishmentIdAndPoliticianIdAndVisibleTrue(UUID accomplishmentId, UUID politicianId);
}
