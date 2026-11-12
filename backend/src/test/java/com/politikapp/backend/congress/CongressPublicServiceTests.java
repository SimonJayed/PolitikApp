package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class CongressPublicServiceTests {
    private JdbcTemplate jdbc;
    private CongressPublicService service;
    private TimelineEntryRepository timelines;
    private final UUID selected = UUID.randomUUID();

    @BeforeEach
    void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:public_records_" + UUID.randomUUID()
                + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("create table politicians (politician_id uuid primary key, status varchar)");
        jdbc.execute("create table open_congress_entities (id varchar primary key, kind varchar, politician_id uuid, current_revision varchar, linked_at timestamp)");
        jdbc.execute("create table open_congress_revisions (entity_id varchar, revision varchar, title varchar, congress int, subtype varchar, filed_date date, payload varchar, source_urls varchar, dataset_commit varchar, dataset_path varchar, bill_number varchar, imported_at timestamp)");
        jdbc.execute("create table open_congress_relationships (entity_id varchar, revision varchar, target_id varchar, relationship varchar)");
        jdbc.update("insert into politicians values (?, 'ACTIVE')", selected);
        jdbc.update("insert into open_congress_entities values ('person', 'PERSON', ?, 'r1', timestamp '2025-01-01 00:00:00')", selected);
        jdbc.update("insert into open_congress_entities values ('other', 'PERSON', ?, 'r1', timestamp '2025-01-01 00:00:00')", UUID.randomUUID());
        jdbc.update("insert into open_congress_revisions (entity_id,revision,payload,source_urls,dataset_commit,dataset_path,imported_at) values ('person','r1',?, '[]','commit','data/person/person.toml', timestamp '2024-01-01 00:00:00')",
                "{\"memberships\":[{\"type\":\"chamber\",\"subtype\":\"senate\",\"congress\":19},{\"type\":\"chamber\",\"subtype\":\"senate\",\"congress\":20},{\"type\":\"chamber\",\"subtype\":\"house\",\"congress\":14}]}");
        for (int i = 1; i <= 6; i++) bill("bill-" + i, i <= 3 ? 19 : 20, "person", "AUTHORED_BY");
        bill("coauthored", 20, "person", "CO_AUTHORED_BY");
        bill("sponsored", 20, "person", "SPONSORED_BY");
        bill("other-author", 20, "other", "AUTHORED_BY");
        timelines = mock(TimelineEntryRepository.class);
        when(timelines.findActiveEntries(selected, "PUBLISHED")).thenReturn(List.of());
        service = new CongressPublicService(jdbc, new ObjectMapper(), timelines);
    }

    private void bill(String id, int congress, String person, String relationship) {
        jdbc.update("insert into open_congress_entities values (?, 'BILL', null, 'r1', null)", id);
        jdbc.update("insert into open_congress_revisions values (?, 'r1', ?, ?, 'senate', date '2024-01-01', ?, ?, 'commit', ?, '2145', timestamp '2024-01-01 00:00:00')",
                id, id, congress, "{\"status\":[{\"date\":\"2024-01-02\",\"status\":\"Filed\"}],\"history\":[{\"date\":\"2024-01-01\",\"action\":\"Filed with the Senate\"}]}",
                "[\"https://github.com/bettergovph/data.toml\",\"https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-2145\"]", "data/bill/" + id + ".toml");
        jdbc.update("insert into open_congress_relationships values (?, 'r1', ?, ?)", id, person, relationship);
    }

    @Test
    void onlySelectedAuthorsBillsCountAndPaginateMembershipsRemainSeparate() {
        var first = service.publicRecords(selected, 0, 5);
        assertEquals(6, first.total());
        assertEquals(5, first.records().size());
        assertEquals(3, first.memberships().size());
        assertEquals(List.of("20", "19"), first.congresses());
        assertTrue(first.records().stream().allMatch(row -> "BILL".equals(row.type())
                && "AUTHORED_BY".equals(row.relationshipType()) && selected.equals(row.authorPoliticianId())));
        var last = service.publicRecords(selected, 5, 5);
        assertEquals(1, last.records().size());
        assertFalse(first.records().stream().anyMatch(row -> row.key().contains("coauthored") || row.key().contains("other-author")));
    }

    @Test
    void congressFilterPreservesOriginalSourcesStatusesHistoryAndProvenance() {
        var page = service.publicRecords(selected, 0, 5, 19);
        assertEquals(3, page.total());
        assertEquals(3, page.records().size());
        assertEquals(3, page.memberships().size());
        var row = page.records().get(0);
        assertEquals("19", row.congress());
        assertTrue(row.sourceUrl().contains("?congress=19&q=SBN-2145"));
        assertTrue(row.datasetUrl().contains("bettergovph/open-congress-data/blob/commit"));
        assertTrue(row.reportedStatus().contains("Filed"));
        assertEquals("Filed with the Senate", row.history().get(0).path("action").asText());
        assertEquals("SOURCE_REPORTED", row.reviewState());
        assertEquals(0, service.publicRecords(selected, 0, 5, 8).total());
        assertTrue(jdbc.queryForObject("select source_urls from open_congress_revisions where entity_id='bill-1'", String.class).contains("github.com"));
        verify(timelines, never()).save(any());
    }

    @Test
    void approvalCannotExposeAnotherPersonsBillOrInventAuthorship() {
        var wrong = new TimelineEntry();
        wrong.setPoliticianId(selected);
        wrong.setActionDetails(Map.of("sourceReported", true, "sourceKey", "bill:other-author", "recordType", "BILL",
                "sourceRevision", "r1", "title", "Wrong author", "congress", 20));
        when(timelines.findActiveEntries(selected, "PUBLISHED")).thenReturn(List.of(wrong));
        assertEquals(6, service.publicRecords(selected, 0, 50).total());
        verify(timelines, never()).save(any());
    }
}
