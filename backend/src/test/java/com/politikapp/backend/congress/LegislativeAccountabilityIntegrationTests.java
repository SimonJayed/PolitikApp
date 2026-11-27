package com.politikapp.backend.congress;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.legislative-accountability.enabled=true")
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LegislativeAccountabilityIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AuthUserRepository users;
    @Autowired JwtService jwt;
    @Autowired DataSource dataSource;
    private String admin;
    private String contributor;

    @BeforeAll
    void setup() throws Exception {
        var resource = new ClassPathResource("db/legislative-migration/V30__add_legislative_accountability.sql");
        String schema = resource.getContentAsString(StandardCharsets.UTF_8).split("-- PostgreSQL access control", 2)[0];
        new ResourceDatabasePopulator(new ByteArrayResource(schema.getBytes(StandardCharsets.UTF_8))).execute(dataSource);
        admin = token("ADMIN");
        contributor = token("CONTRIBUTOR");
    }

    @Test
    void draftsArePrivateAndAdministratorsCanVerifyWithdrawAndRestore() throws Exception {
        String politician = profile("SENATOR");
        String publicPath = path(politician, false);
        String manage = path(politician, true);
        var input = attendance("Journal 3", "PRESENT");
        input.put("verificationStatus", "PENDING_VERIFICATION");
        input.remove("sourceUrl");
        input.remove("verificationNotes");

        mvc.perform(get(manage).header("Authorization", contributor)).andExpect(status().isForbidden());
        mvc.perform(post(manage).header("Authorization", contributor)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isForbidden());
        mvc.perform(post(manage).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isUnauthorized());

        JsonNode draft = create(manage, input);
        String id = draft.path("record").path("recordId").asText();
        mvc.perform(get(manage).header("Authorization", admin))
                .andExpect(jsonPath("$.records[0].record.verificationStatus").value("PENDING_VERIFICATION"));
        mvc.perform(get(publicPath)).andExpect(status().isOk()).andExpect(jsonPath("$.records").isEmpty());
        mvc.perform(get(publicPath + "/" + id)).andExpect(status().isNotFound());

        var article = attendance("Journal 3", "PRESENT");
        article.put("revision", 0);
        String body = json.writeValueAsString(article);
        mvc.perform(put(manage + "/" + id).header("Authorization", contributor)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(put(manage + "/" + id).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1))
                .andExpect(jsonPath("$.verificationNotes").value("Local test fixture"));
        mvc.perform(put(manage + "/" + id).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        mvc.perform(get(publicPath + "/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceUrl").value("https://legacy.senate.gov.ph/lisdata/fixture.pdf#page=2"))
                .andExpect(jsonPath("$.sourceOrganization").value("Senate of the Philippines"))
                .andExpect(jsonPath("$.reviewedAt").isNotEmpty())
                .andExpect(jsonPath("$.verificationNotes").doesNotExist()).andExpect(jsonPath("$.reviewedBy").doesNotExist());

        String otherPolitician = profile("HOUSE_REPRESENTATIVE");
        mvc.perform(get(path(otherPolitician, false) + "/" + id)).andExpect(status().isNotFound());
        mvc.perform(delete(manage + "/" + id).param("revision", "1").header("Authorization", contributor))
                .andExpect(status().isForbidden());
        mvc.perform(delete(manage + "/" + id).header("Authorization", admin)).andExpect(status().isBadRequest());
        mvc.perform(delete(manage + "/" + id).param("revision", "1").header("Authorization", admin))
                .andExpect(status().isNoContent());
        mvc.perform(get(publicPath + "/" + id)).andExpect(status().isNotFound());
        mvc.perform(get(manage).header("Authorization", admin))
                .andExpect(jsonPath("$.records[0].withdrawnAt").isNotEmpty());
        article.put("revision", 2);
        mvc.perform(put(manage + "/" + id).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(article))).andExpect(status().isOk());
        mvc.perform(get(publicPath + "/" + id)).andExpect(status().isOk());
    }

    @Test
    void attendanceSummaryUsesVerifiedRecordsAcrossPagesAndSeparatesTerms() throws Exception {
        String politician = profile("SENATOR");
        String manage = path(politician, true);
        create(manage, attendance("Journal 1", "PRESENT"));
        create(manage, attendance("Journal 2", "ABSENT"));
        create(manage, attendance("Journal 3", "EXCUSED"));
        create(manage, attendance("Journal 4", "UNAVAILABLE"));
        var older = attendance("Journal 20", "EXCUSED");
        older.put("congress", 19);
        older.put("eventDate", "2024-08-18");
        create(manage, older);
        var eighth = attendance("Journal 50", "PRESENT");
        eighth.put("congress", 8);
        eighth.put("eventDate", "1991-08-18");
        create(manage, eighth);
        var pending = attendance("Journal 5", "PRESENT");
        pending.put("verificationStatus", "UNVERIFIED");
        create(manage, pending);

        mvc.perform(get(path(politician, false)).param("kind", "ATTENDANCE").param("congress", "20")
                .param("chamber", "SENATE").param("limit", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.hasMore").value(true))
                .andExpect(jsonPath("$.records.length()").value(1))
                .andExpect(jsonPath("$.attendance.length()").value(1))
                .andExpect(jsonPath("$.attendance[0].percentage").value(50.0))
                .andExpect(jsonPath("$.attendance[0].unavailable").value(1));
        mvc.perform(get(path(politician, false)).param("kind", "ATTENDANCE").param("congress", "19"))
                .andExpect(jsonPath("$.attendance[0].excused").value(1))
                .andExpect(jsonPath("$.attendance[0].percentage").doesNotExist());
    }

    @Test
    void votesAndCommitteeRolesValidateChamberTermAndEvidence() throws Exception {
        String profile = profile("HOUSE_REPRESENTATIVE");
        String manage = path(profile, true);
        var vote = new HashMap<String, Object>(Map.of("kind", "VOTE", "chamber", "HOUSE", "congress", 20,
                "title", "Test measure", "reference", "HB 1, vote 2", "decision", "NO",
                "eventDate", "2025-08-18", "verificationStatus", "VERIFIED",
                "sourceUrl", "https://docs.congress.gov.ph/fixture.pdf", "verificationNotes", "Local test fixture"));
        create(manage, vote);
        vote.put("decision", "YES");
        postExpect(manage, vote, 409);
        vote.put("reference", "HB 1, vote 3");
        vote.put("sourceUrl", "https://senate.gov.ph/fixture.pdf");
        postExpect(manage, vote, 422);
        vote.put("sourceUrl", "https://congress.gov.ph.example.test/fixture.pdf");
        postExpect(manage, vote, 422);
        vote.put("sourceUrl", "https://congress.gov.ph/index.php?utm_source=chatgpt.com");
        postExpect(manage, vote, 422);
        vote.put("sourceUrl", "https://docs.congress.gov.ph/fixture.pdf");
        vote.put("eventDate", "2024-08-18");
        postExpect(manage, vote, 422);
        vote.put("eventDate", "2025-08-18");
        vote.put("decision", "PRESENT");
        postExpect(manage, vote, 422);

        var committee = new HashMap<>(vote);
        committee.put("kind", "COMMITTEE");
        committee.put("title", "Test committee");
        committee.put("decision", "VICE_CHAIR");
        committee.remove("reference");
        committee.remove("eventDate");
        committee.remove("verificationNotes");
        postExpect(manage, committee, 422);
        committee.put("verificationNotes", "Local test fixture");
        create(manage, committee);
        mvc.perform(get(path(profile, false)).param("kind", "COMMITTEE"))
                .andExpect(jsonPath("$.records[0].decision").value("VICE_CHAIR"))
                .andExpect(jsonPath("$.records[0].eventDate").doesNotExist());
        mvc.perform(get(path(profile, false)).param("kind", "VOTE").param("offset", "1"))
                .andExpect(jsonPath("$.records").isEmpty());
        mvc.perform(get(path(profile, false)).param("limit", "101")).andExpect(status().isBadRequest());
        mvc.perform(get(path(profile, false)).param("kind", "BOGUS")).andExpect(status().isBadRequest());
    }

    private HashMap<String, Object> attendance(String reference, String decision) {
        return new HashMap<>(Map.of("kind", "ATTENDANCE", "chamber", "SENATE", "congress", 20,
                "reference", reference, "decision", decision, "eventDate", "2025-08-18",
                "verificationStatus", "VERIFIED", "verificationNotes", "Local test fixture",
                "sourceUrl", "https://legacy.senate.gov.ph/lisdata/fixture.pdf?utm_source=chatgpt.com#page=2"));
    }

    private JsonNode create(String manage, Map<String, Object> input) throws Exception {
        return postExpect(manage, input, 201);
    }

    private JsonNode postExpect(String manage, Map<String, Object> input, int expected) throws Exception {
        return json.readTree(mvc.perform(post(manage).header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString());
    }

    private String profile(String position) throws Exception {
        var profile = Map.of("fullName", "Test fixture " + UUID.randomUUID(), "position", position,
                "jurisdiction", "NATIONAL", "termStart", "2025-06-30", "termEnd", "2028-06-30");
        String result = mvc.perform(post("/api/politicians").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(profile)))
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
        return "Bearer " + jwt.generateAccessToken(user.getUserId(), user.getEmail(), role);
    }

    private static String path(String id, boolean manage) {
        return "/api/" + (manage ? "admin/" : "") + "politicians/" + id + "/legislative-accountability";
    }
}
