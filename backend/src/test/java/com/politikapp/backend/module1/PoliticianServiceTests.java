package com.politikapp.backend.module1;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.UpdatePoliticianRequest;
import com.politikapp.backend.module1.repository.CityMunicipalityRepository;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.repository.ProvinceRepository;
import com.politikapp.backend.module1.repository.RegionRepository;
import com.politikapp.backend.module1.service.PoliticianMapper;
import com.politikapp.backend.module1.service.PoliticianService;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PoliticianServiceTests {
    private final PoliticianService service = new PoliticianService(
            mock(PoliticianRepository.class),
            mock(PoliticianMapper.class),
            mock(RegionRepository.class),
            mock(ProvinceRepository.class),
            mock(CityMunicipalityRepository.class)
    );

    @Test
    void rejectsNationalPoliticianWithLocalGovernmentPosition() {
        UpdatePoliticianRequest request = new UpdatePoliticianRequest(
                "Test Official",
                "Mayor",
                "NATIONAL",
                "Local Government",
                "NATIONAL",
                null,
                null,
                null,
                "Independent",
                null,
                "Bio",
                "ACTIVE",
                LocalDate.of(2025, 6, 30),
                LocalDate.of(2028, 6, 30)
        );

        assertThrows(HttpResponseException.class, () -> service.createPolitician(request));
    }

    @Test
    void rejectsLocalCityPositionWithoutCityMunicipality() {
        UpdatePoliticianRequest request = new UpdatePoliticianRequest(
                "Test Official",
                "Councilor",
                "LOCAL",
                "Local Government",
                "CEBU",
                UUID.randomUUID(),
                UUID.randomUUID(),
                null,
                "Independent",
                null,
                "Bio",
                "ACTIVE",
                LocalDate.of(2025, 6, 30),
                LocalDate.of(2028, 6, 30)
        );

        assertThrows(HttpResponseException.class, () -> service.createPolitician(request));
    }
}
