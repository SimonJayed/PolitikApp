package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.PoliticianFilterRequest;
import com.politikapp.backend.module1.dto.PoliticianResponse;
import com.politikapp.backend.module1.dto.UpdatePoliticianRequest;
import com.politikapp.backend.module1.entity.CityMunicipality;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.Province;
import com.politikapp.backend.module1.entity.Region;
import com.politikapp.backend.module1.repository.CityMunicipalityRepository;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.repository.ProvinceRepository;
import com.politikapp.backend.module1.repository.RegionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@SuppressWarnings("null")
public class PoliticianService {
    private static final Set<String> JURISDICTION_TYPES = Set.of("NATIONAL", "LOCAL");
    private static final Set<String> POSITION_CATEGORIES = Set.of("Executive", "Legislative", "Judicial", "Local Government");
    private static final Set<String> NATIONAL_POSITIONS = Set.of(
            "President", "Vice President", "Cabinet Secretary", "Undersecretary", "Assistant Secretary",
            "Senator", "Senate President", "House Representative", "Party-list Representative",
            "Speaker of the House", "Chief Justice", "Associate Justice", "Judge"
    );
    private static final Set<String> PROVINCE_POSITIONS = Set.of("Governor", "Vice Governor", "Provincial Board Member");
    private static final Set<String> CITY_POSITIONS = Set.of("Mayor", "Vice Mayor", "Councilor");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "INACTIVE", "ARCHIVED");

    private final PoliticianRepository politicianRepository;
    private final PoliticianMapper politicianMapper;
    private final RegionRepository regionRepository;
    private final ProvinceRepository provinceRepository;
    private final CityMunicipalityRepository cityMunicipalityRepository;

    public PoliticianService(
            PoliticianRepository politicianRepository,
            PoliticianMapper politicianMapper,
            RegionRepository regionRepository,
            ProvinceRepository provinceRepository,
            CityMunicipalityRepository cityMunicipalityRepository
    ) {
        this.politicianRepository = politicianRepository;
        this.politicianMapper = politicianMapper;
        this.regionRepository = regionRepository;
        this.provinceRepository = provinceRepository;
        this.cityMunicipalityRepository = cityMunicipalityRepository;
    }

    @Transactional(readOnly = true)
    public List<PoliticianResponse> getPoliticians(PoliticianFilterRequest filters) {
        return politicianRepository.findAll(buildSpecification(filters), Sort.by("fullName").ascending())
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
        PoliticianFilterRequest filters = new PoliticianFilterRequest(name, null, null, null, null, null, null, null, null);
        return getPoliticians(filters);
    }

    @Transactional
    public PoliticianResponse createPolitician(UpdatePoliticianRequest request) {
        Politician politician = new Politician();
        applyChanges(politician, request, true);
        return politicianMapper.toResponse(politicianRepository.save(politician));
    }

    @Transactional
    public PoliticianResponse updatePolitician(UUID politicianId, UpdatePoliticianRequest updates) {
        Politician politician = politicianRepository.findById(politicianId)
                .orElseThrow(() -> new HttpResponseException(404, "Not Found: Politician record does not exist."));
        applyChanges(politician, updates, false);
        return politicianMapper.toResponse(politicianRepository.save(politician));
    }

    private Specification<Politician> buildSpecification(PoliticianFilterRequest filters) {
        return (root, query, cb) -> {
            var predicate = cb.conjunction();
            if (filters == null) return predicate;
            if (hasText(filters.query())) {
                String pattern = "%" + filters.query().trim().toLowerCase(Locale.ROOT) + "%";
                predicate = cb.and(predicate, cb.or(
                        cb.like(cb.lower(root.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("position")), pattern)
                ));
            }
            if (hasText(filters.jurisdictionType())) predicate = cb.and(predicate, cb.equal(cb.upper(cb.trim(root.get("jurisdictionType"))), normalizeCode(filters.jurisdictionType())));
            if (hasText(filters.positionCategory())) predicate = cb.and(predicate, cb.equal(root.get("positionCategory"), filters.positionCategory().trim()));
            if (hasText(filters.position())) predicate = cb.and(predicate, cb.equal(root.get("position"), filters.position().trim()));
            if (filters.regionId() != null) predicate = cb.and(predicate, cb.equal(root.get("region").get("regionId"), filters.regionId()));
            if (filters.provinceId() != null) predicate = cb.and(predicate, cb.equal(root.get("province").get("provinceId"), filters.provinceId()));
            if (filters.cityMunicipalityId() != null) predicate = cb.and(predicate, cb.equal(root.get("cityMunicipality").get("cityMunicipalityId"), filters.cityMunicipalityId()));
            if (hasText(filters.partyAffiliation())) predicate = cb.and(predicate, cb.equal(root.get("partyAffiliation"), filters.partyAffiliation().trim()));
            if (hasText(filters.status())) predicate = cb.and(predicate, cb.equal(cb.upper(cb.trim(root.get("status"))), normalizeCode(filters.status())));
            return predicate;
        };
    }

    private void applyChanges(Politician politician, UpdatePoliticianRequest request, boolean creating) {
        String jurisdictionType = normalizeCode(requireText(request.jurisdictionType(), "Jurisdiction type is required."));
        String category = requireText(request.positionCategory(), "Position category is required.");
        String position = requireText(request.position(), "Position is required.");
        validatePosition(category, position, jurisdictionType);

        politician.setFullName(requireText(request.fullName(), "Full name is required."));
        politician.setJurisdictionType(jurisdictionType);
        politician.setPositionCategory(category);
        politician.setPosition(position);
        politician.setPartyAffiliation(clean(request.partyAffiliation()));
        politician.setProfileImageUrl(clean(request.profileImageUrl()));
        politician.setBiography(clean(request.biography()));
        politician.setStatus(normalizeStatus(request.status(), creating ? "ACTIVE" : politician.getStatus()));
        politician.setTermStart(resolveDate(request.termStart(), politician.getTermStart(), creating, "Term start is required."));
        politician.setTermEnd(resolveDate(request.termEnd(), politician.getTermEnd(), creating, "Term end is required."));
        if (politician.getTermEnd().isBefore(politician.getTermStart())) throw new HttpResponseException(400, "Term end cannot be earlier than term start.");

        if ("NATIONAL".equals(jurisdictionType)) {
            politician.setRegion(null);
            politician.setProvince(null);
            politician.setCityMunicipality(null);
            politician.setJurisdiction("NATIONAL");
            return;
        }

        Region region = regionRepository.findById(requireUuid(request.regionId(), "Region is required."))
                .orElseThrow(() -> new HttpResponseException(400, "Region does not exist."));
        Province province = provinceRepository.findById(requireUuid(request.provinceId(), "Province is required."))
                .orElseThrow(() -> new HttpResponseException(400, "Province does not exist."));
        if (!province.getRegion().getRegionId().equals(region.getRegionId())) throw new HttpResponseException(400, "Province does not belong to the selected region.");

        CityMunicipality city = null;
        if (CITY_POSITIONS.contains(position)) {
            city = cityMunicipalityRepository.findById(requireUuid(request.cityMunicipalityId(), "City/Municipality is required for this position."))
                    .orElseThrow(() -> new HttpResponseException(400, "City/Municipality does not exist."));
            if (!city.getProvince().getProvinceId().equals(province.getProvinceId())) throw new HttpResponseException(400, "City/Municipality does not belong to the selected province.");
        }
        politician.setRegion(region);
        politician.setProvince(province);
        politician.setCityMunicipality(PROVINCE_POSITIONS.contains(position) ? null : city);
        politician.setJurisdiction(city == null ? normalizeCode(province.getProvinceName()) : normalizeCode(city.getName()));
    }

    private void validatePosition(String category, String position, String jurisdictionType) {
        if (!JURISDICTION_TYPES.contains(jurisdictionType)) throw new HttpResponseException(400, "Invalid jurisdiction type.");
        if (!POSITION_CATEGORIES.contains(category)) throw new HttpResponseException(400, "Invalid position category.");
        if ("Local Government".equals(category)) {
            if (!"LOCAL".equals(jurisdictionType)) throw new HttpResponseException(400, "Local government positions require LOCAL jurisdiction.");
            if (!PROVINCE_POSITIONS.contains(position) && !CITY_POSITIONS.contains(position)) throw new HttpResponseException(400, "Invalid local government position.");
            return;
        }
        if (!"NATIONAL".equals(jurisdictionType)) throw new HttpResponseException(400, "Executive, legislative, and judicial positions require NATIONAL jurisdiction.");
        if (!NATIONAL_POSITIONS.contains(position)) throw new HttpResponseException(400, "Invalid national position.");
    }

    private String normalizeStatus(String status, String fallback) {
        String value = hasText(status) ? normalizeCode(status) : normalizeCode(fallback);
        if (value == null || !STATUSES.contains(value)) throw new HttpResponseException(400, "Invalid status.");
        return value;
    }

    private LocalDate resolveDate(LocalDate requestDate, LocalDate existingDate, boolean creating, String message) {
        if (requestDate != null) return requestDate;
        if (!creating && existingDate != null) return existingDate;
        throw new HttpResponseException(400, message);
    }

    private UUID requireUuid(UUID value, String message) {
        if (value == null) throw new HttpResponseException(400, message);
        return value;
    }

    private String requireText(String value, String message) {
        if (!hasText(value)) throw new HttpResponseException(400, message);
        return value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeCode(String value) {
        if (!hasText(value)) return null;
        return value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
    }
}
