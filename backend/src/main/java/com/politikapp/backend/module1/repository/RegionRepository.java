package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.Region;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegionRepository extends JpaRepository<Region, UUID> {
    List<Region> findAllByOrderByRegionNameAsc();
}
