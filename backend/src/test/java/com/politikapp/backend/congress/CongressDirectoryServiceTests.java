package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.Mockito.*;

class CongressDirectoryServiceTests {
    private final CongressDirectoryService service = new CongressDirectoryService(mock(JdbcTemplate.class), new ObjectMapper(),
            Clock.fixed(Instant.parse("2026-11-12T00:00:00Z"), ZoneId.of("Asia/Manila")));
    private Map<String, Object> source(String kind, UUID id, String payload) {
        var row = new HashMap<String, Object>();row.put("kind", kind);row.put("politician_id", id);row.put("payload", payload);return row;
    }

    @Test
    void identifiesCurrentCongressByDatesRatherThanLargestNumberOrPersonalTerm() {
        var result = service.assemble(List.of(
                source("CONGRESS", null, """
                        {"congress_number":19,"start_date":"2022-07-25","end_date":"2025-06-11"}
                        """),
                source("CONGRESS", null, """
                        {"congress_number":20,"start_date":"2025-07-28"}
                        """),
                source("CONGRESS", null, """
                        {"congress_number":21,"start_date":"2028-07-24"}
                        """)), List.of(), LocalDate.of(2026, 11, 12));
        assertEquals(20, result.currentCongress());
        assertEquals(LocalDate.of(2026, 11, 12), result.asOfDate());
    }

    @Test
    void preservesChamberHistoryNamesAndReviewedMembershipsWithoutDuplicates() {
        UUID id = UUID.randomUUID();
        var sources = List.of(source("PERSON", id, """
                {"first_name":"Maria","last_name":"Santos","memberships":[
                {"type":"chamber","subtype":"senate","congress":8},
                {"type":"chamber","subtype":"house","congress":19},
                {"type":"chamber","subtype":"house","congress":19},
                {"type":"committee","subtype":"senate","congress":20},
                {"type":"chamber","subtype":"unknown","congress":20},
                {"type":"chamber","subtype":"senate","congress":"unknown"}]}
                """));
        var reviewed = List.<Map<String,Object>>of(Map.of("politician_id", id, "payload", "{\"chamber\":\"senate\",\"congress\":20}"));
        var result = service.assemble(sources, reviewed, LocalDate.of(2026, 11, 12));
        assertNull(result.currentCongress());
        assertEquals("Santos", result.people().get(0).lastName());
        assertEquals("Maria", result.people().get(0).firstName());
        assertEquals(List.of(new CongressDirectoryService.Membership("senate",20),
                new CongressDirectoryService.Membership("house",19),new CongressDirectoryService.Membership("senate",8)), result.people().get(0).memberships());
    }

    @Test
    void emptyOrUndatedDatasetDoesNotInventCurrentCongress() {
        var result = service.assemble(List.of(source("CONGRESS", null, "{\"congress_number\":20}")), List.of(), LocalDate.of(2026, 11, 12));
        assertNull(result.currentCongress());
        assertTrue(result.people().isEmpty());
    }
}
