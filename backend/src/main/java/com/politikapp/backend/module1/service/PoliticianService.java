package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.PoliticianResponse;
import com.politikapp.backend.module1.dto.UpdatePoliticianRequest;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@SuppressWarnings("null")
public class PoliticianService {
    private static final String ACTIVE_STATUS = "ACTIVE";

    private final PoliticianRepository politicianRepository;
    private final PoliticianMapper politicianMapper;

    public PoliticianService(PoliticianRepository politicianRepository, PoliticianMapper politicianMapper) {
        this.politicianRepository = politicianRepository;
        this.politicianMapper = politicianMapper;
    }

    @Transactional(readOnly = true)
    public List<PoliticianResponse> getActivePoliticians() {
        return politicianRepository.findByStatusOrderByFullNameAsc(ACTIVE_STATUS)
                .stream()
                .map(politicianMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PoliticianResponse getPolitician(UUID politicianId) {
        return politicianRepository.findById(politicianId)
                .map(politicianMapper::toResponse)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Politician record does not exist."));
    }

    @Transactional(readOnly = true)
    public List<PoliticianResponse> searchPoliticians(String name) {
        if (name == null || name.isBlank()) {
            return getActivePoliticians();
        }

        return politicianRepository
                .findByFullNameContainingIgnoreCaseAndStatusOrderByFullNameAsc(name.trim(), ACTIVE_STATUS)
                .stream()
                .map(politicianMapper::toResponse)
                .toList();
    }

    @Transactional
    public PoliticianResponse updatePolitician(UUID politicianId, UpdatePoliticianRequest updates) {
        Politician politician = politicianRepository.findById(politicianId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Politician record does not exist."));

        politician.setFullName(updates.fullName());
        politician.setPosition(updates.position());
        politician.setJurisdiction(updates.jurisdiction());
        politician.setPartyAffiliation(updates.partyAffiliation());
        politician.setProfileImageUrl(updates.profileImageUrl());
        politician.setBiography(updates.biography());

        Politician saved = politicianRepository.save(politician);
        return politicianMapper.toResponse(saved);
    }
}
