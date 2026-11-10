package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class CongressPopulationTests {
    private static final String COMMIT="a".repeat(40);
    private final ObjectMapper json=new ObjectMapper();

    @Test
    void identityMatchingPreservesSuffixesAndUsesOnlyDocumentedAliases() throws Exception {
        var person=json.readTree("""
                {"first_name":"Ana Theresia","middle_name":"Navarro","last_name":"Hontiveros-Baraquel","aliases":["Risa"]}
                """);
        assertTrue(CongressPopulationService.matches("Risa Hontiveros","Ana Theresia Navarro Hontiveros-Baraquel",person));
        assertFalse(CongressPopulationService.matches("Maria Hontiveros","Ana Theresia Navarro Hontiveros-Baraquel",person));
        var marcos=json.readTree("{\"first_name\":\"Ferdinand\",\"last_name\":\"Marcos\",\"name_suffix\":\"Jr\"}");
        assertTrue(CongressPopulationService.matches("Ferdinand \"Bongbong\" Romualdez Marcos Jr.","Ferdinand Romualdez Marcos Jr",marcos));
        assertFalse(CongressPopulationService.matches("Ferdinand Marcos Sr","Ferdinand Romualdez Marcos Jr",marcos));
    }

    @Test
    void populationIsIdempotentPreservesCuratedFieldsAndAcceptsMissingPersonalDetails() throws Exception {
        var fixture=new Fixture();
        UUID existing=UUID.randomUUID();
        fixture.jdbc.update("insert into politicians(politician_id,full_name,status,position) values (?,?,'ACTIVE','PRESIDENT')",existing,"Ferdinand Marcos Jr");
        fixture.person("existing","Ferdinand Marcos Jr","Ferdinand","Marcos","Jr");
        fixture.person("new-person","Maria Santos","Maria","Santos","");
        var preview=fixture.service.preview(COMMIT);
        assertEquals(1,preview.created()); assertEquals(1,preview.existingLinked());
        assertEquals(1,fixture.jdbc.queryForObject("select count(*) from politicians",Integer.class));
        var first=fixture.tx.execute(status -> fixture.service.populate(COMMIT));
        assertEquals(1,first.created()); assertEquals(1,first.existingLinked());
        assertEquals("PRESIDENT",fixture.jdbc.queryForObject("select position from politicians where politician_id=?",String.class,existing));
        var imported=fixture.jdbc.queryForMap("select * from politicians where profile_origin='CONGRESS_DATASET'");
        assertNull(imported.get("position")); assertNull(imported.get("term_start"));
        assertNull(imported.get("term_end")); assertNull(imported.get("jurisdiction"));
        assertEquals("INACTIVE",imported.get("status"));
        var second=fixture.tx.execute(status -> fixture.service.populate(COMMIT));
        assertEquals(0,second.created()); assertEquals(0,second.existingLinked()); assertEquals(2,second.alreadyLinked());
        assertEquals(2,fixture.jdbc.queryForObject("select count(*) from politicians",Integer.class));
    }

    @Test
    void duplicateSourceNamesAreReportedInsteadOfMergedOrFabricated() throws Exception {
        var fixture=new Fixture();
        fixture.person("one","Mercedes C Cagas","Mercedes","Cagas","");
        fixture.person("two","Mercedes C Cagas","Mercedes","Cagas","");
        var result=fixture.tx.execute(status -> fixture.service.populate(COMMIT));
        assertEquals(2,result.skipped()); assertEquals(0,result.created());
        assertEquals(0,fixture.jdbc.queryForObject("select count(*) from politicians",Integer.class));
        assertTrue(result.rows().stream().allMatch(r -> r.reason().contains("same normalized full name")));
    }

    @Test
    void auditFailureRollsBackProfileCreationAndLinks() throws Exception {
        var fixture=new Fixture(); fixture.person("new","Maria Santos","Maria","Santos","");
        fixture.jdbc.execute("drop table open_congress_population_runs");
        assertThrows(Exception.class,() -> fixture.tx.execute(status -> fixture.service.populate(COMMIT)));
        assertEquals(0,fixture.jdbc.queryForObject("select count(*) from politicians",Integer.class));
        assertEquals(0,fixture.jdbc.queryForObject("select count(politician_id) from open_congress_entities",Integer.class));
    }

    private class Fixture {
        final JdbcTemplate jdbc;
        final CongressPopulationService service;
        final TransactionTemplate tx;
        Fixture() {
            var ds=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa","");
            jdbc=spy(new JdbcTemplate(ds));
            // H2 has no PostgreSQL table-lock syntax; the real import verifies that path.
            doNothing().when(jdbc).execute(startsWith("lock table"));
            jdbc.execute("create table politicians(politician_id uuid primary key,full_name varchar(150) unique,status varchar(30),position varchar(100),jurisdiction varchar(100),term_start date,term_end date,profile_origin varchar(40) default 'ADMIN_CURATED',created_at timestamp,updated_at timestamp)");
            jdbc.execute("create table open_congress_entities(id varchar primary key,kind varchar,current_revision varchar,politician_id uuid unique,linked_at timestamp)");
            jdbc.execute("create table open_congress_revisions(entity_id varchar,revision varchar,title varchar,payload varchar,dataset_commit varchar,imported_at timestamp)");
            jdbc.execute("create table open_congress_relationships(entity_id varchar,revision varchar,relationship varchar,target_id varchar)");
            jdbc.execute("create table open_congress_population_runs(id uuid,dataset_commit varchar,report jsonb)");
            service=new CongressPopulationService(jdbc,json);
            tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
        }
        void person(String id,String name,String first,String last,String suffix) throws Exception {
            jdbc.update("insert into open_congress_entities(id,kind,current_revision) values (?,'PERSON','rev')",id);
            jdbc.update("insert into open_congress_revisions(entity_id,revision,title,payload,dataset_commit,imported_at) values (?,'rev',?,?,?,now())",id,name,
                    json.writeValueAsString(Map.of("first_name",first,"last_name",last,"name_suffix",suffix)),COMMIT);
        }
    }
}
