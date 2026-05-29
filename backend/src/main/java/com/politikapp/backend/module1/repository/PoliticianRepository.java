package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.Politician;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PoliticianRepository extends JpaRepository<Politician, UUID>, JpaSpecificationExecutor<Politician> {
    List<Politician> findAllByOrderByFullNameAsc();

    List<Politician> findByFullNameContainingIgnoreCaseOrderByFullNameAsc(String fullName);

    Optional<Politician> findByFullName(String fullName);
}
