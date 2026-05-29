package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.CityMunicipalityResponse;
import com.politikapp.backend.module1.dto.ProvinceResponse;
import com.politikapp.backend.module1.dto.RegionResponse;
import com.politikapp.backend.module1.service.JurisdictionLookupService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
public class JurisdictionLookupController {
    private final JurisdictionLookupService jurisdictionLookupService;

    public JurisdictionLookupController(JurisdictionLookupService jurisdictionLookupService) {
        this.jurisdictionLookupService = jurisdictionLookupService;
    }

    @GetMapping("/api/regions")
    public ResponseEntity<List<RegionResponse>> getRegions() {
        return ResponseEntity.ok(jurisdictionLookupService.getRegions());
    }

    @GetMapping("/api/provinces")
    public ResponseEntity<List<ProvinceResponse>> getProvinces(@RequestParam UUID regionId) {
        return ResponseEntity.ok(jurisdictionLookupService.getProvinces(regionId));
    }

    @GetMapping("/api/cities-municipalities")
    public ResponseEntity<List<CityMunicipalityResponse>> getCitiesMunicipalities(@RequestParam UUID provinceId) {
        return ResponseEntity.ok(jurisdictionLookupService.getCitiesMunicipalities(provinceId));
    }
}
