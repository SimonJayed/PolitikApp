package com.politikapp.backend.politician;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.politician.entity.TimelineEntry;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.citation-reviews.enabled=true")
@AutoConfigureMockMvc
class AccountabilityWorkflowIntegrationTests {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AuthUserRepository users;
    @Autowired private JwtService jwt;
    @Autowired private TimelineEntryRepository timelines;
    @Autowired private ProfileEditSubmissionRepository submissions;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void allSupportedCategoriesRetainCitationsAndRespectAdministrativeAccess() throws Exception {
        String admin = token("ADMIN");
        String publicUser = token("CONTRIBUTOR");
        String mayor = profile(admin, "MAYOR");
        String senator = profile(admin, "SENATOR");
        String budget = record(admin, mayor, "BUDGET_ALLOCATION", Map.of("allocationAmount", 1250), "https://www.dbm.gov.ph/");
        record(admin, mayor, "COA_FINDING", Map.of("flaggedAmount", 100), "https://www.coa.gov.ph/");
        record(admin, mayor, "PROJECT_COMPLETION", Map.of("completionPercentage", 100), "https://www.dpwh.gov.ph/");
        record(admin, senator, "SPONSORED_LEGISLATION", Map.of("legislationTitle", "Test fixture only", "dateFiled", "2023-02-07", "legislativeStatus", "Filed"), "https://legacy.senate.gov.ph/");
        mvc.perform(get("/api/politicians/{id}/dashboard", mayor)).andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedBudgetAllocated").value(1250))
                .andExpect(jsonPath("$.coaAuditDiscrepancies").value(1))
                .andExpect(jsonPath("$.projectCompletions").value(1))
                .andExpect(jsonPath("$.publishedTimelineLedger.length()").value(3));
        mvc.perform(get("/api/politicians/{id}/dashboard", senator)).andExpect(status().isOk())
                .andExpect(jsonPath("$.billsAuthored").value(1));
        mvc.perform(delete("/api/admin/curation/metrics/{id}", budget).header("Authorization", "Bearer " + publicUser))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/curation/metrics/{id}", budget).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/politicians/{id}/dashboard", mayor)).andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedBudgetAllocated").value(0))
                .andExpect(jsonPath("$.publishedTimelineLedger.length()").value(2));
        mvc.perform(post("/api/admin/curation/metrics").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "politicianId", mayor, "categoryTag", "Finance", "actionIdentifier", "BUDGET_ALLOCATION",
                        "actionDetails", Map.of("allocationAmount", -1), "impactSummary", "Test fixture only",
                        "primarySourceUrl", "https://www.dbm.gov.ph/"))))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void adminsCanCreateAndEditRecordsWithCitationsFromAnyWebsite() throws Exception {
        String admin = token("ADMIN");
        String politician = profile(admin, "MAYOR");
        String timeline = record(admin, politician, "BUDGET_ALLOCATION", Map.of("allocationAmount", 500), "https://example.com/budget/report?year=2026");
        String replacement = "https://drive.google.com/file/d/test-report/view";
        String payload = json.writeValueAsString(Map.of(
                "politicianId", politician, "categoryTag", "Finance", "actionIdentifier", "BUDGET_ALLOCATION",
                "actionDetails", Map.of("allocationAmount", 600), "impactSummary", "Isolated test fixture only.",
                "primarySourceUrl", replacement));
        mvc.perform(put("/api/admin/curation/metrics/{id}", timeline).header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sourceUrl").value(replacement));
        mvc.perform(get("/api/politicians/{id}/dashboard", politician)).andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedBudgetAllocated").value(600))
                .andExpect(jsonPath("$.publishedTimelineLedger[0].sourceUrl").value(replacement));
        mvc.perform(post("/api/admin/curation/metrics").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/curation/metrics").header("Authorization", "Bearer " + token("CONTRIBUTOR"))
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isForbidden());
    }

    @Test
    void citationReviewSeparatesPublicStatusFromPrivateEvidenceNotesAndPublication() throws Exception {
        String admin = token("ADMIN");
        String contributor = token("CONTRIBUTOR");
        String politician = profile(admin, "SENATOR");
        String recordId = record(admin, politician, "COA_FINDING", Map.of("flaggedAmount", 100), "https://coa.gov.ph/audit.pdf");
        String base = "/api/admin/citation-reviews";
        String reviews = "/api/politicians/" + politician + "/citation-reviews";
        String adminHeader = "Bearer " + admin;
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(get(base).header("Authorization", "Bearer " + contributor)).andExpect(status().isForbidden());
        mvc.perform(get(reviews)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(base).param("recordId", politician).param("missingSource", "true")
                .header("Authorization", adminHeader)).andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].id").value(politician));
        mvc.perform(get(base).param("recordId", recordId).param("missingSource", "true")
                .header("Authorization", adminHeader)).andExpect(status().isOk())
                .andExpect(jsonPath("$.records.length()").value(0));
        mvc.perform(get(base).param("recordId", "not-a-uuid").header("Authorization", adminHeader))
                .andExpect(status().isBadRequest());
        String page = mvc.perform(get(base).param("type", "TIMELINE").param("status", "UNVERIFIED")
                .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String version = null;
        for (var row : json.readTree(page).path("records")) {
            if (recordId.equals(row.path("id").asText())) version = row.path("recordUpdatedAt").asText();
        }
        org.junit.jupiter.api.Assertions.assertNotNull(version);

        var payload = json.createObjectNode().put("status", "VERIFIED")
                .put("sourceUrl", "https://coa.gov.ph/report.pdf?utm_source=chatgpt.com#page=2")
                .put("sourceOrganization", "Commission on Audit")
                .put("verificationNotes", "Private fixture evidence notes")
                .put("recordUpdatedAt", version);
        String url = base + "/TIMELINE/" + recordId;
        mvc.perform(put(url).header("Authorization", "Bearer " + contributor)
                .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isForbidden());
        mvc.perform(put(url).header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isUnprocessableEntity());
        payload.put("attribution", "ASSOCIATED_AGENCY");
        payload.put("sourceUrl", "https://coa.gov.ph@outside.example/report.pdf");
        mvc.perform(put(url).header("Authorization", adminHeader).contentType(MediaType.APPLICATION_JSON)
                .content(payload.toString())).andExpect(status().isUnprocessableEntity());
        payload.put("sourceUrl", "https://coa.gov.ph/report.pdf?utm_source=chatgpt.com#page=2");
        mvc.perform(put(url).header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceUrl").value("https://coa.gov.ph/report.pdf#page=2"));
        mvc.perform(put(url).header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isConflict());
        mvc.perform(get(reviews)).andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("VERIFIED"))
                .andExpect(jsonPath("$[0].attribution").value("ASSOCIATED_AGENCY"))
                .andExpect(jsonPath("$[0].verificationNotes").doesNotExist());
        mvc.perform(get(base).param("type", "TIMELINE").param("status", "VERIFIED").param("limit", "1")
                .header("Authorization", "Bearer " + admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].id").value(recordId));
        mvc.perform(delete("/api/admin/curation/metrics/{id}", recordId).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        mvc.perform(get(reviews)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void budgetBreakdownReconcilesWithDashboardAndUsesPublicCitationReview() throws Exception {
        String admin = token("ADMIN");
        String politician = profile(admin, "SENATOR");
        String publicProfile = "/api/politicians/" + politician;
        String path = publicProfile + "/budget-breakdown";
        mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("$.exactTotal").value("0"))
                .andExpect(jsonPath("$.recordCount").value(0)).andExpect(jsonPath("$.allocations").isEmpty());

        String linkedId = record(admin, politician, "BUDGET_ALLOCATION", Map.of(
                "allocationAmount", 200, "allocationTitle", "Classroom budget", "fiscalYear", 2026,
                "sourceOrganization", "Original publisher"), "https://dbm.gov.ph/fixture.pdf");
        var linked = timelines.findById(UUID.fromString(linkedId)).orElseThrow();
        var duplicate = TimelineEntry.publishedFrom(submissions.findById(linked.getSubmissionId()).orElseThrow());
        timelines.saveAndFlush(duplicate);
        timeline(politician, "FY 2024 community budget", Map.of("allocationAmount", new BigDecimal("50.125")), false);
        timeline(politician, "Imported amount", Map.of("allocationAmount", 500, "sourceReported", true), false);
        timeline(politician, "Hidden standalone amount", Map.of("allocationAmount", 600), true);
        String withdrawnId = record(admin, politician, "BUDGET_ALLOCATION", Map.of("allocationAmount", 800),
                "https://dbm.gov.ph/withdrawn.pdf");
        var withdrawn = timelines.findById(UUID.fromString(withdrawnId)).orElseThrow();
        withdrawn.setIsHidden(true);
        timelines.saveAndFlush(withdrawn);
        timeline(politician, "Migrated non-numeric amount", Map.of("allocationAmount", "invalid"), false);

        String queue = mvc.perform(get("/api/admin/citation-reviews").param("recordId", linkedId)
                .header("Authorization", "Bearer " + admin)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var payload = json.createObjectNode().put("status", "VERIFIED").put("sourceOrganization", "Reviewed publisher")
                .put("sourceUrl", "https://dbm.gov.ph/official.pdf#page=2").put("verificationNotes", "Private notes")
                .put("recordUpdatedAt", json.readTree(queue).path("records").path(0).path("recordUpdatedAt").asText());
        mvc.perform(put("/api/admin/citation-reviews/TIMELINE/" + linkedId).header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isOk());

        var result = mvc.perform(get(path)).andExpect(status().isOk())
                .andExpect(jsonPath("$.exactTotal").value("250.125"))
                .andExpect(jsonPath("$.recordCount").value(2))
                .andExpect(jsonPath("$.allocations[0].title").value("Classroom budget"))
                .andExpect(jsonPath("$.allocations[0].exactAmount").value("200"))
                .andExpect(jsonPath("$.allocations[0].fiscalYear").value(2026))
                .andExpect(jsonPath("$.allocations[0].sourceOrganization").value("Reviewed publisher"))
                .andExpect(jsonPath("$.allocations[0].sourceUrl").value("https://dbm.gov.ph/official.pdf#page=2"))
                .andExpect(jsonPath("$.allocations[0].verificationStatus").value("VERIFIED"))
                .andExpect(jsonPath("$.allocations[0].verificationNotes").doesNotExist())
                .andExpect(jsonPath("$.allocations[1].verificationStatus").value("UNVERIFIED"))
                .andExpect(jsonPath("$.allocations[1].fiscalYear").value(2024))
                .andReturn().getResponse().getContentAsString();
        var percent = json.readTree(result).path("allocations").path(0).path("contributionPercentage").asDouble();
        org.junit.jupiter.api.Assertions.assertEquals(20000.0 / 250.125, percent, 0.00001);
        mvc.perform(get(publicProfile + "/dashboard")).andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedBudgetAllocated").value(250.125));
        mvc.perform(get(publicProfile)).andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedBudgetAllocated").value(250.125));
    }

    @Test
    void budgetBreakdownKeepsExactStoredJsonDecimalsAndOmitsAmbiguousFiscalYears() throws Exception {
        String politician = profile(token("ADMIN"), "SENATOR");
        timeline(politician, "FY 2025 and FY 2026 shared allocation",
                Map.of("allocationAmount", new BigDecimal("9007199254740993.125")), false);
        timeline(politician, "Documented budget adjustment",
                Map.of("allocationAmount", new BigDecimal("0.345")), false);
        String stored = jdbc.queryForObject("select cast(action_details as varchar) from public.timeline_entries"
                + " where politician_id=? and summary like 'FY 2025%'", String.class, UUID.fromString(politician));
        org.junit.jupiter.api.Assertions.assertTrue(stored.contains("9007199254740993.125"), stored);
        mvc.perform(get("/api/politicians/" + politician + "/budget-breakdown")).andExpect(status().isOk())
                .andExpect(jsonPath("$.exactTotal").value("9007199254740993.470"))
                .andExpect(jsonPath("$.recordCount").value(2))
                .andExpect(jsonPath("$.allocations[0].exactAmount").value("9007199254740993.125"))
                .andExpect(jsonPath("$.allocations[0].fiscalYear").doesNotExist())
                .andExpect(jsonPath("$.allocations[1].exactAmount").value("0.345"));
    }

    private void timeline(String politician, String description, Map<String, Object> details, boolean hidden) {
        var entry = new TimelineEntry();
        entry.setPoliticianId(UUID.fromString(politician));
        entry.setCategoryTag("Finance");
        entry.setActionIdentifier("BUDGET_ALLOCATION");
        entry.setSummary(description);
        entry.setActionDetails(details);
        entry.setIsHidden(hidden);
        timelines.saveAndFlush(entry);
    }

    private String record(String token, String politician, String action, Map<String, Object> details, String source) throws Exception {
        String result = mvc.perform(post("/api/admin/curation/metrics").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "politicianId", politician, "categoryTag", "Test", "actionIdentifier", action,
                        "actionDetails", details, "impactSummary", "Isolated test fixture, not a factual political claim.",
                        "primarySourceUrl", source))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sourceUrl").value(source))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(result).path("timelineId").asText();
    }

    private String profile(String token, String position) throws Exception {
        String result = mvc.perform(post("/api/politicians").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "fullName", "Test fixture " + UUID.randomUUID(), "position", position,
                        "jurisdiction", "NATIONAL", "termStart", "2022-06-30", "termEnd", "2028-06-30"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(result).path("politicianId").asText();
    }

    private String token(String role) {
        var user = new AuthUser();
        user.setUserId(UUID.randomUUID());
        user.setEmail(UUID.randomUUID() + "@test.invalid");
        user.setUsername(UUID.randomUUID().toString());
        user.setFullName("Test fixture user");
        user.setPasswordHash("test-fixture-hash");
        user.setRole(role);
        user.setAccountStatus("ACTIVE");
        users.save(user);
        return jwt.generateAccessToken(user.getUserId(), user.getEmail(), role);
    }
}
