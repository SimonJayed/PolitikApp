package com.politikapp.backend.accomplishment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccomplishmentIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PoliticianRepository politicians;
    @Autowired AccomplishmentRepository accomplishments;
    @Autowired AuthUserRepository users;
    @Autowired JwtService jwt;

    UUID politicianId;
    AuthUser admin;
    String adminToken;
    String memberToken;

    @BeforeEach
    void setup() {
        var politician = new Politician();
        politician.setFullName("Accomplishment Test Politician");
        politician.setPosition("Mayor");
        politician.setJurisdiction("Test City");
        politician.setTermStart(LocalDate.of(2025, 1, 1));
        politician.setTermEnd(LocalDate.of(2028, 1, 1));
        politicianId = politicians.saveAndFlush(politician).getPoliticianId();
        admin = account("ADMIN");
        adminToken = token(admin);
        memberToken = token(account("CONTRIBUTOR"));
    }

    AuthUser account(String role) {
        String unique = UUID.randomUUID().toString();
        var user = new AuthUser();
        user.setUserId(UUID.randomUUID());
        user.setFullName("Accomplishment " + role);
        user.setEmail(unique + "@example.com");
        user.setUsername(unique);
        user.setPasswordHash("not-used-by-these-jwt-tests");
        user.setRole(role);
        user.setAccountStatus("ACTIVE");
        return users.saveAndFlush(user);
    }

    String token(AuthUser user) { return jwt.generateAccessToken(user.getUserId(), user.getEmail(), user.getRole()); }
    String publicPath() { return "/api/politicians/" + politicianId + "/accomplishments"; }
    String adminPath() { return "/api/admin/politicians/" + politicianId + "/accomplishments"; }

    Map<String, Object> valid() {
        var request = new LinkedHashMap<String, Object>();
        request.put("title", "  Public service award  ");
        request.put("description", "  Received an award for documented public service.  ");
        request.put("accomplishmentYear", 2025);
        request.put("category", "Public service");
        request.put("sourceUrl", "https://www.dost.gov.ph/official-award");
        request.put("visible", true);
        return request;
    }

    JsonNode create(Map<String, Object> request) throws Exception {
        return json.readTree(mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andReturn().getResponse().getContentAsString());
    }

    @Test
    void createsDedicatedRecordAndGuestsAndMembersCanReadDetails() throws Exception {
        var result = create(valid());
        assertEquals("Public service award", result.path("title").asText());
        assertFalse(result.path("createdAt").isNull());
        assertFalse(result.path("updatedAt").isNull());
        var id = UUID.fromString(result.path("accomplishmentId").asText());
        assertEquals(politicianId, accomplishments.findById(id).orElseThrow().getPoliticianId());
        mvc.perform(get(publicPath())).andExpect(status().isOk()).andExpect(jsonPath("$[0].title").value("Public service award"));
        mvc.perform(get(publicPath() + "/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceUrl").value(valid().get("sourceUrl")));
        mvc.perform(get(publicPath()).header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void returnsEmptyListForExistingPolitician() throws Exception {
        mvc.perform(get(publicPath())).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void rejectsMissingAndBlankRequiredFieldsAndOverlongInput() throws Exception {
        for (String field : List.of("title", "description", "sourceUrl", "visible")) {
            var request = valid(); request.remove(field);
            mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
        for (String field : List.of("title", "description", "sourceUrl")) {
            var request = valid(); request.put(field, "   ");
            mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
        var request = valid(); request.put("title", "a".repeat(201));
        mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        assertTrue(accomplishments.findByPoliticianIdOrderByCreatedAtDescAccomplishmentIdAsc(politicianId).isEmpty());
    }

    @Test
    void rejectsUnknownAndArchivedPoliticians() throws Exception {
        mvc.perform(post("/api/admin/politicians/" + UUID.randomUUID() + "/accomplishments")
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(valid()))).andExpect(status().isNotFound());
        var politician = politicians.findById(politicianId).orElseThrow();
        politician.setStatus("ARCHIVED"); politicians.saveAndFlush(politician);
        mvc.perform(get(publicPath())).andExpect(status().isNotFound());
        mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid())))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatesRecordAndRetainsItsIdentityAndCreationTime() throws Exception {
        var created = create(valid());
        var request = valid();
        request.put("title", "Updated award"); request.remove("accomplishmentYear");
        request.put("accomplishmentDate", "2025-06-12");
        mvc.perform(put(adminPath() + "/" + created.path("accomplishmentId").asText())
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request))).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated award"))
                .andExpect(jsonPath("$.accomplishmentDate").value("2025-06-12"))
                .andExpect(jsonPath("$.createdAt").value(created.path("createdAt").asText()));
    }

    @Test
    void hidesWithoutDeletingAndAdminCanEditHiddenRecord() throws Exception {
        var created = create(valid());
        String id = created.path("accomplishmentId").asText();
        mvc.perform(delete(adminPath() + "/" + id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
        var retained = accomplishments.findById(UUID.fromString(id)).orElseThrow();
        assertFalse(retained.isVisible()); assertEquals("Public service award", retained.getTitle());
        assertEquals(valid().get("sourceUrl"), retained.getSourceUrl());
        mvc.perform(get(publicPath())).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get(publicPath() + "/" + id)).andExpect(status().isNotFound());
        mvc.perform(get(adminPath()).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].visible").value(false));
        var request = valid(); request.put("visible", false); request.put("title", "Corrected hidden award");
        mvc.perform(put(adminPath() + "/" + id).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.visible").value(false));
        mvc.perform(get(publicPath())).andExpect(content().json("[]"));
    }

    @Test
    void rejectsGuestAndRegisteredUserAdminAccessForEveryOperation() throws Exception {
        String id = UUID.randomUUID().toString();
        for (var operation : List.of(get(adminPath()), post(adminPath()), put(adminPath() + "/" + id), delete(adminPath() + "/" + id))) {
            mvc.perform(operation.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid())))
                    .andExpect(status().isUnauthorized());
            mvc.perform(operation.header("Authorization", "Bearer " + memberToken))
                    .andExpect(status().isForbidden());
        }
        // Public paths cannot be used as a mutation bypass.
        mvc.perform(post(publicPath()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid())))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(publicPath()).header("Authorization", "Bearer " + memberToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid())))
                .andExpect(status().isForbidden());
    }

    @Test
    void revokedAdministratorRoleIsCheckedAgainstDatabase() throws Exception {
        admin.setRole("CONTRIBUTOR"); users.saveAndFlush(admin);
        mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid())))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidCitationsAndAmbiguousOrInvalidDatesAreRejected() throws Exception {
        for (String source : List.of("javascript:alert(1)", "https://example.com/award", "https://dost.gov.ph.evil.com/", "https://user@dost.gov.ph/")) {
            var request = valid(); request.put("sourceUrl", source);
            mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                    .andExpect(status().isUnprocessableEntity());
        }
        var ambiguous = valid(); ambiguous.put("accomplishmentDate", "2025-01-01");
        mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(ambiguous)))
                .andExpect(status().isUnprocessableEntity());
        var badYear = valid(); badYear.put("accomplishmentYear", 0);
        mvc.perform(post(adminPath()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(badYear)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownDateIsAllowedAndHiddenCreationIsNotPublic() throws Exception {
        var request = valid(); request.remove("accomplishmentYear"); request.put("visible", false);
        var created = create(request);
        assertTrue(created.path("accomplishmentDate").isNull());
        assertTrue(created.path("accomplishmentYear").isNull());
        mvc.perform(get(publicPath())).andExpect(content().json("[]"));
    }

    @Test
    void recordCannotBeReadOrChangedThroughAnotherPolitician() throws Exception {
        String id = create(valid()).path("accomplishmentId").asText();
        var second = new Politician(); second.setFullName("Different Politician");
        second.setPosition("Mayor"); second.setJurisdiction("Other City");
        UUID other = politicians.saveAndFlush(second).getPoliticianId();
        mvc.perform(get("/api/politicians/" + other + "/accomplishments/" + id)).andExpect(status().isNotFound());
        mvc.perform(put("/api/admin/politicians/" + other + "/accomplishments/" + id)
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(valid()))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/admin/politicians/" + other + "/accomplishments/" + id)
                .header("Authorization", "Bearer " + adminToken)).andExpect(status().isNotFound());
        assertTrue(accomplishments.findById(UUID.fromString(id)).orElseThrow().isVisible());
    }
}
