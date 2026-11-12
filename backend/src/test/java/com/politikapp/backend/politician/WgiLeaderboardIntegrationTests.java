package com.politikapp.backend.politician;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.politician.service.PoliticianMapper;
import com.politikapp.backend.politician.service.WgiLeaderboardService;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:wgi_leaderboard_test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;INIT=CREATE SCHEMA IF NOT EXISTS public")
@AutoConfigureMockMvc
@Transactional
class WgiLeaderboardIntegrationTests {
    @Autowired PoliticianRepository politicians;
    @Autowired ProfileEditSubmissionRepository submissions;
    @Autowired TimelineEntryRepository timelines;
    @Autowired WgiLeaderboardService leaderboard;
    @Autowired PoliticianMapper mapper;
    @Autowired MockMvc mvc;

    Politician person(String name, String position) {
        var person = new Politician();person.setFullName(name);person.setPosition(position);person.setJurisdiction("NATIONAL");
        return politicians.saveAndFlush(person);
    }
    ProfileEditSubmission record(Politician person, String action, Map<String,Object> details) {
        return submissions.saveAndFlush(ProfileEditSubmission.directPublished(person.getPoliticianId(), UUID.randomUUID(),
                "https://senate.gov.ph/fixture", "LEGISLATION", action, details, "Test published evidence", "Test verification"));
    }
    TimelineEntry timeline(Politician person, String action, Map<String,Object> details, String status, boolean hidden) {
        var entry = new TimelineEntry();entry.setPoliticianId(person.getPoliticianId());entry.setActionIdentifier(action);
        entry.setActionDetails(details);entry.setCategoryTag("LEGISLATION");entry.setSummary("Test record");
        entry.setSourceUrl("https://senate.gov.ph/fixture");entry.setPublicationStatus(status);entry.setIsHidden(hidden);
        return timelines.saveAndFlush(entry);
    }

    @Test
    void ranksDescendingUsingTheExistingMapperAndKeepsGenuineZero() {
        var low = person("Low", "SENATOR");record(low,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","FILED"));
        var high = person("High", "SENATOR");record(high,"BUDGET_ALLOCATION",Map.of("allocationAmount",500000000));
        var zero = person("Zero with evidence", "SENATOR");record(zero,"COA_FINDING",Map.of("flaggedAmount",5000));
        person("No evidence", "SENATOR");
        var page = leaderboard.leaderboard(0,8);
        assertEquals(List.of(high.getPoliticianId(),low.getPoliticianId(),zero.getPoliticianId()),page.entries().stream().map(WgiLeaderboardService.Entry::politicianId).toList());
        assertEquals(mapper.toResponse(high).wgiCompositeScore(),page.entries().get(0).wgiCompositeScore());
        assertEquals(mapper.toResponse(low).wgiCompositeScore(),page.entries().get(1).wgiCompositeScore());
        assertEquals(0.0,page.entries().get(2).wgiCompositeScore());
        assertEquals(1,page.unrankedCount());assertNotNull(page.calculatedAt());assertNotNull(page.entries().get(0).sourceUpdatedAt());
    }

    @Test
    void restoresOldMetricTieBreaksAndSequentialRanksThenUsesName() {
        var moreBills = person("Zulu with more filed bills", "SENATOR");
        for(int i=0;i<10;i++)record(moreBills,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","FILED"));
        var fewer = person("Alpha with fewer enacted bills", "SENATOR");
        for(int i=0;i<3;i++)record(fewer,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","ENACTED"));
        var same = person("Beta with fewer enacted bills", "SENATOR");
        for(int i=0;i<3;i++)record(same,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","ENACTED"));
        var page=leaderboard.leaderboard(0,8);
        assertEquals(page.entries().get(0).wgiCompositeScore(),page.entries().get(1).wgiCompositeScore(),0.000001);
        assertEquals(List.of(moreBills.getPoliticianId(),fewer.getPoliticianId(),same.getPoliticianId()),page.entries().stream().map(WgiLeaderboardService.Entry::politicianId).toList());
        assertEquals(List.of(1,2,3),page.entries().stream().map(WgiLeaderboardService.Entry::rank).toList());
    }

    @Test
    void missingInvalidArchivedAndSourceReportedScoresReceiveNoRank() {
        person("Missing score", "SENATOR");
        var invalid=person("Invalid numeric input", "MAYOR");record(invalid,"PROJECT_COMPLETION",Map.of("completionPercentage","NaN"));
        var archived=person("Archived", "SENATOR");record(archived,"BUDGET_ALLOCATION",Map.of("allocationAmount",500));
        archived.setStatus("ARCHIVED");politicians.saveAndFlush(archived);
        var sourceOnly=person("Only imported claims", "SENATOR");
        timeline(sourceOnly,"SPONSORED_LEGISLATION",Map.of("sourceReported",true,"legislativeStatus","ENACTED"),"PUBLISHED",false);
        var page=leaderboard.leaderboard(0,8);
        assertTrue(page.entries().isEmpty());assertEquals(0,page.totalRanked());assertEquals(3,page.unrankedCount());
    }

    @Test
    void excludesDraftHiddenAndOfficeIncompatibleRecords() {
        var person=person("Private and hidden", "SENATOR");
        timeline(person,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","ENACTED"),"DRAFT",false);
        timeline(person,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","ENACTED"),"PUBLISHED",true);
        record(person,"PROJECT_COMPLETION",Map.of("completionPercentage",100));
        assertTrue(leaderboard.leaderboard(0,8).entries().isEmpty());
    }

    @Test
    void verifiedTimelineScoresMatchProfileAndMirroredSubmissionsAreNotDoubleCounted() {
        var person=person("Verified bill", "SENATOR");
        var submission=record(person,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","FILED"));
        var mirror=timeline(person,"SPONSORED_LEGISLATION",Map.of("legislativeStatus","FILED"),"PUBLISHED",false);
        mirror.setSubmissionId(submission.getSubmissionId());timelines.saveAndFlush(mirror);
        timeline(person,"SPONSORED_LEGISLATION",Map.of("openCongressId","verified-bill","legislativeStatus","ENACTED"),"PUBLISHED",false);
        assertEquals(mapper.toResponse(person).wgiCompositeScore(),leaderboard.leaderboard(0,8).entries().get(0).wgiCompositeScore());
    }

    @Test
    void publicApiPaginatesAndRejectsInvalidBoundsWithoutChangingRecords() throws Exception {
        for(int i=0;i<10;i++)record(person("Member "+i,"SENATOR"),"BUDGET_ALLOCATION",Map.of("allocationAmount",i*1000));
        long count=timelines.count()+submissions.count();
        mvc.perform(get("/api/politicians/leaderboard?offset=0&limit=6")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(6)).andExpect(jsonPath("$.entries[0].rank").value(1)).andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/politicians/leaderboard?offset=6&limit=6")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(4)).andExpect(jsonPath("$.entries[0].rank").value(7)).andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/politicians/leaderboard?offset=-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/politicians/leaderboard?limit=0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/politicians/leaderboard?limit=51")).andExpect(status().isBadRequest());
        assertEquals(count,timelines.count()+submissions.count());
    }
}
