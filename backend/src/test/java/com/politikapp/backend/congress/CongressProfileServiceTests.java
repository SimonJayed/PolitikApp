package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;

import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.politician.service.PoliticianService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Optional;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class CongressProfileServiceTests {
    @Test
    void membershipImportCreatesOnlyPrivateDraft() throws Exception {
        var store = mock(CongressStore.class);
        var timelines = mock(TimelineEntryRepository.class);
        var jdbc = mock(JdbcTemplate.class);
        UUID politicianId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        when(jdbc.queryForList(anyString(), eq("source-person"))).thenReturn(List.of(Map.of("id", "source-person")));
        when(store.get("source-person")).thenReturn(new ObjectMapper().readTree("""
                {"politicianId":"%s","datasetUrl":"https://github.com/bettergovph/open-congress-data",
                 "payload":{"memberships":[{"congress":20,"subtype":"senate","position":"Senator"}]}}
                """.formatted(politicianId)));
        when(timelines.save(any(TimelineEntry.class))).thenAnswer(call -> call.getArgument(0));
        var service = new CongressProfileService(store, jdbc, mock(PoliticianRepository.class),
                mock(PoliticianService.class), timelines);

        UUID draftId = service.draftMembership("source-person", 0);

        var saved = org.mockito.ArgumentCaptor.forClass(TimelineEntry.class);
        verify(timelines).save(saved.capture());
        assertEquals(draftId, saved.getValue().getTimelineId());
        assertEquals("DRAFT", saved.getValue().getPublicationStatus());
        assertEquals("MEMBERSHIP", saved.getValue().getActionDetails().get("recordType"));
        assertEquals(null, saved.getValue().getSourceUrl());
    }

    @Test
    void suggestsOnlyUniqueExactNamesWithCompatibleMembership() throws Exception {
        var store = mock(CongressStore.class);
        var jdbc = mock(JdbcTemplate.class);
        var politicians = mock(PoliticianRepository.class);
        var unique = profile("Maria Santos");
        unique.setPosition("Senator");
        var ambiguous = profile("Juan Dela Cruz");
        when(politicians.findAllByOrderByFullNameAsc()).thenReturn(List.of(unique, ambiguous));
        when(jdbc.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of());
        when(store.unlinkedPeople()).thenReturn(List.of(
                Map.of("id", "one", "name", "MARIA SANTOS"),
                Map.of("id", "two", "name", "Juan Dela Cruz"),
                Map.of("id", "three", "name", "Juan  Dela-Cruz")));
        when(store.get("one")).thenReturn(new ObjectMapper().readTree("""
                {"payload":{"memberships":[{"subtype":"senate","congress":20}]}}
                """));
        var service = new CongressProfileService(store, jdbc, politicians,
                mock(PoliticianService.class), mock(TimelineEntryRepository.class));

        var candidates = service.matchCandidates();

        assertEquals(1, candidates.size());
        assertEquals("one", candidates.get(0).sourceId());
        assertEquals(unique.getPoliticianId(), candidates.get(0).politicianId());
    }

    @Test
    void draftRequiresOfficialEvidenceAndExplicitReviewBeforePublication() {
        var timelines = mock(TimelineEntryRepository.class);
        var draft = new TimelineEntry();
        UUID id = UUID.randomUUID();
        UUID politicianId = UUID.randomUUID();
        draft.setTimelineId(id);
        draft.setPoliticianId(politicianId);
        draft.setPublicationStatus("DRAFT");
        draft.setActionDetails(Map.of("openCongressId", "source-bill", "openCongressPersonId", "source-person", "recordType", "BILL"));
        when(timelines.findById(id)).thenReturn(Optional.of(draft));
        when(timelines.save(any(TimelineEntry.class))).thenAnswer(call -> call.getArgument(0));
        var store = mock(CongressStore.class);
        when(store.get("source-person")).thenReturn(new ObjectMapper().valueToTree(
                Map.of("politicianId", politicianId.toString())));
        var service = new CongressProfileService(store, mock(JdbcTemplate.class),
                mock(PoliticianRepository.class), mock(PoliticianService.class), timelines);

        assertThrows(HttpResponseException.class, () -> service.publishDraft(id, "https://example.com/bill",
                "Official record confirms the bill status.", "FILED", "Reviewed summary", UUID.randomUUID()));
        assertEquals("DRAFT", draft.getPublicationStatus());

        service.publishDraft(id, "https://www.senate.gov.ph/bills/example", "Official bill page confirms the filing and author.",
                "FILED", "This bill was filed, according to the Senate record.", UUID.randomUUID());
        assertEquals("PUBLISHED", draft.getPublicationStatus());
        assertEquals("FILED", draft.getActionDetails().get("verifiedStatus"));
        assertTrue(draft.getVerificationNotes().contains("Official bill page"));
        verify(timelines).save(draft);
    }

    private static Politician profile(String name) {
        var profile = new Politician();
        profile.setPoliticianId(UUID.randomUUID());
        profile.setFullName(name);
        return profile;
    }
}
