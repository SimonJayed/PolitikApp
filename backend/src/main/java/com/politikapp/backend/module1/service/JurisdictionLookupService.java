package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.CityMunicipalityResponse;
import com.politikapp.backend.module1.dto.ProvinceResponse;
import com.politikapp.backend.module1.dto.RegionResponse;
import com.politikapp.backend.module1.repository.CityMunicipalityRepository;
import com.politikapp.backend.module1.repository.ProvinceRepository;
import com.politikapp.backend.module1.repository.RegionRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JurisdictionLookupService {
    private final RegionRepository regionRepository;
    private final ProvinceRepository provinceRepository;
    private final CityMunicipalityRepository cityMunicipalityRepository;

    public JurisdictionLookupService(
            RegionRepository regionRepository,
            ProvinceRepository provinceRepository,
            CityMunicipalityRepository cityMunicipalityRepository
    ) {
        this.regionRepository = regionRepository;
        this.provinceRepository = provinceRepository;
        this.cityMunicipalityRepository = cityMunicipalityRepository;
    }

    @Transactional(readOnly = true)
    public List<RegionResponse> getRegions() {
        return regionRepository.findAllByOrderByRegionNameAsc()
                .stream()
                .map(region -> new RegionResponse(region.getRegionId(), region.getRegionCode(), region.getRegionName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProvinceResponse> getProvinces(UUID regionId) {
        return provinceRepository.findByRegionRegionIdOrderByProvinceNameAsc(regionId)
                .stream()
                .map(province -> new ProvinceResponse(
                        province.getProvinceId(),
                        province.getRegion().getRegionId(),
                        province.getProvinceName()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CityMunicipalityResponse> getCitiesMunicipalities(UUID provinceId) {
        return cityMunicipalityRepository.findByProvinceProvinceIdOrderByNameAsc(provinceId)
                .stream()
                .map(city -> new CityMunicipalityResponse(
                        city.getCityMunicipalityId(),
                        city.getProvince().getProvinceId(),
                        city.getName(),
                        city.getType()
                ))
                .toList();
    }
}
