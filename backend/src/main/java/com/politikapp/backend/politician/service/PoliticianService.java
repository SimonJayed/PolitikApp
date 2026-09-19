package com.politikapp.backend.politician.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.dto.CreatePoliticianRequest;
import com.politikapp.backend.politician.dto.PoliticianResponse;
import com.politikapp.backend.politician.dto.UpdatePoliticianRequest;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@SuppressWarnings("null")
public class PoliticianService {
    private final PoliticianRepository politicianRepository;
    private final PoliticianMapper politicianMapper;
    private final ProfileEditSubmissionRepository submissionRepository;

    public PoliticianService(
            PoliticianRepository politicianRepository,
            PoliticianMapper politicianMapper,
            ProfileEditSubmissionRepository submissionRepository
    ) {
        this.politicianRepository = politicianRepository;
        this.politicianMapper = politicianMapper;
        this.submissionRepository = submissionRepository;
    }

    @Transactional(readOnly = true)
    public List<PoliticianResponse> getPoliticians() {
        return mapPoliticiansWithSubmissions(politicianRepository.findAllByOrderByFullNameAsc());
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

        return mapPoliticiansWithSubmissions(
                politicianRepository.findByFullNameContainingIgnoreCaseOrderByFullNameAsc(name.trim())
        );
    }

    private List<PoliticianResponse> mapPoliticiansWithSubmissions(List<Politician> politicians) {
        if (politicians.isEmpty()) {
            return Collections.emptyList();
        }

        List<UUID> politicianIds = politicians.stream()
                .map(Politician::getPoliticianId)
                .filter(Objects::nonNull)
                .toList();

        Map<UUID, List<ProfileEditSubmission>> submissionsByPolitician = submissionRepository
                .findByPoliticianIdInAndStatus(politicianIds, "PUBLISHED")
                .stream()
                .collect(Collectors.groupingBy(ProfileEditSubmission::getPoliticianId));

        return politicians.stream()
                .map(p -> politicianMapper.toResponse(
                        p,
                        submissionsByPolitician.getOrDefault(p.getPoliticianId(), Collections.emptyList())
                ))
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
