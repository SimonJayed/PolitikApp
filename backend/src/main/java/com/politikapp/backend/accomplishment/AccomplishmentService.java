package com.politikapp.backend.accomplishment;

import com.politikapp.backend.accomplishment.AccomplishmentDtos.*;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.submission.service.SourceValidationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AccomplishmentService {
    private final AccomplishmentRepository accomplishments;
    private final PoliticianRepository politicians;
    private final SourceValidationService sources;

    public AccomplishmentService(AccomplishmentRepository accomplishments, PoliticianRepository politicians,
            SourceValidationService sources) {
        this.accomplishments = accomplishments;
        this.politicians = politicians;
        this.sources = sources;
    }

    public List<Response> list(UUID politicianId, boolean includeHidden) {
        requirePolitician(politicianId);
        return (includeHidden
                ? accomplishments.findByPoliticianIdOrderByCreatedAtDescAccomplishmentIdAsc(politicianId)
                : accomplishments.findByPoliticianIdAndVisibleTrueOrderByCreatedAtDescAccomplishmentIdAsc(politicianId))
                .stream().map(Response::from).toList();
    }

    public Response get(UUID politicianId, UUID id) {
        requirePolitician(politicianId);
        return accomplishments.findByAccomplishmentIdAndPoliticianIdAndVisibleTrue(id, politicianId)
                .map(Response::from).orElseThrow(() -> new HttpResponseException(404, "Accomplishment not found."));
    }

    @Transactional
    public Response create(UUID politicianId, UpsertRequest request) {
        requirePolitician(politicianId);
        var entry = new Accomplishment();
        entry.setPoliticianId(politicianId);
        apply(entry, request);
        return Response.from(accomplishments.saveAndFlush(entry));
    }

    @Transactional
    public Response update(UUID politicianId, UUID id, UpsertRequest request) {
        requirePolitician(politicianId);
        var entry = managedRecord(politicianId, id);
        apply(entry, request);
        return Response.from(accomplishments.saveAndFlush(entry));
    }

    @Transactional
    public void hide(UUID politicianId, UUID id) {
        requirePolitician(politicianId);
        var entry = managedRecord(politicianId, id);
        entry.setVisible(false);
        accomplishments.saveAndFlush(entry);
    }

    private Accomplishment managedRecord(UUID politicianId, UUID id) {
        return accomplishments.findByAccomplishmentIdAndPoliticianId(id, politicianId)
                .orElseThrow(() -> new HttpResponseException(404, "Accomplishment not found."));
    }

    private void requirePolitician(UUID id) {
        politicians.findById(id).filter(p -> !"ARCHIVED".equals(p.getStatus()))
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found."));
    }

    private void apply(Accomplishment entry, UpsertRequest request) {
        sources.validateSourceUrl(request.sourceUrl());
        if (request.accomplishmentDate() != null && request.accomplishmentYear() != null) {
            throw new HttpResponseException(422, "Provide a date or a year, not both.");
        }
        if (request.accomplishmentDate() != null && (request.accomplishmentDate().getYear() < 1
                || request.accomplishmentDate().getYear() > 9999)) {
            throw new HttpResponseException(422, "Accomplishment date must have a year between 1 and 9999.");
        }
        entry.setTitle(request.title().trim());
        entry.setDescription(request.description().trim());
        entry.setAccomplishmentDate(request.accomplishmentDate());
        entry.setAccomplishmentYear(request.accomplishmentYear());
        entry.setCategory(request.category() == null || request.category().isBlank() ? null : request.category().trim());
        entry.setSourceUrl(request.sourceUrl().trim());
        entry.setVisible(request.visible());
    }
}
