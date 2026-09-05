package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.CreatePoliticianRequest;
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
    private final PoliticianRepository politicianRepository;
    private final PoliticianMapper politicianMapper;

    public PoliticianService(PoliticianRepository politicianRepository, PoliticianMapper politicianMapper) {
        this.politicianRepository = politicianRepository;
        this.politicianMapper = politicianMapper;
    }

    @Transactional(readOnly = true)
    public List<PoliticianResponse> getPoliticians() {
        return politicianRepository.findAllByOrderByFullNameAsc()
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
            return getPoliticians();
        }

        return politicianRepository
                .findByFullNameContainingIgnoreCaseOrderByFullNameAsc(name.trim())
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

    @Transactional
    public PoliticianResponse createPolitician(CreatePoliticianRequest request) {
        if (request.fullName() == null || request.fullName().isBlank()) {
            throw new HttpResponseException(400, "Bad Request: Full name is required.");
        }
        if (request.position() == null || request.position().isBlank()) {
            throw new HttpResponseException(400, "Bad Request: Position is required.");
        }
        if (request.jurisdiction() == null || request.jurisdiction().isBlank()) {
            throw new HttpResponseException(400, "Bad Request: Jurisdiction is required.");
        }
        if (request.termStart() == null) {
            throw new HttpResponseException(400, "Bad Request: Term start date is required.");
        }
        if (request.termEnd() == null) {
            throw new HttpResponseException(400, "Bad Request: Term end date is required.");
        }
        if (request.termEnd().isBefore(request.termStart())) {
            throw new HttpResponseException(400, "Bad Request: Term end cannot be before term start.");
        }

        Politician politician = new Politician();
        politician.setFullName(request.fullName().trim());
        politician.setPosition(request.position().trim());
        politician.setJurisdiction(request.jurisdiction().trim());
        politician.setPartyAffiliation(request.partyAffiliation() != null ? request.partyAffiliation().trim() : null);
        politician.setProfileImageUrl(request.profileImageUrl() != null ? request.profileImageUrl().trim() : null);
        politician.setBiography(request.biography() != null ? request.biography().trim() : null);
        politician.setStatus(request.status() != null && !request.status().isBlank() ? request.status().trim() : "ACTIVE");
        politician.setTermStart(request.termStart());
        politician.setTermEnd(request.termEnd());

        Politician saved = politicianRepository.save(politician);
        return politicianMapper.toResponse(saved);
    }
}
