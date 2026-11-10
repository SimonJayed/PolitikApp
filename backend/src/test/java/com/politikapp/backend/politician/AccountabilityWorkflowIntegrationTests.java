package com.politikapp.backend.politician;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AccountabilityWorkflowIntegrationTests {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AuthUserRepository users;
    @Autowired private JwtService jwt;

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
