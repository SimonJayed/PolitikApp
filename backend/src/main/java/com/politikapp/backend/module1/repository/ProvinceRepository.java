package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.Province;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProvinceRepository extends JpaRepository<Province, UUID> {
    List<Province> findByRegionRegionIdOrderByProvinceNameAsc(UUID regionId);
}
