package com.politikapp.backend.module1.repository;

import com.politikapp.backend.module1.entity.CityMunicipality;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CityMunicipalityRepository extends JpaRepository<CityMunicipality, UUID> {
    List<CityMunicipality> findByProvinceProvinceIdOrderByNameAsc(UUID provinceId);
}
