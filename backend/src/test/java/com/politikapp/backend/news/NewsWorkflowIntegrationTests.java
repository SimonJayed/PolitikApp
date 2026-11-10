package com.politikapp.backend.news;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.service.ApprovedSourceClient;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {"app.news.retrieval-enabled=true", "app.news.scheduled-enabled=false"})
@AutoConfigureMockMvc
class NewsWorkflowIntegrationTests {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private GovernmentSourceRepository sources;
    @Autowired private AuthUserRepository users;
    @Autowired private JwtService jwt;
    @MockitoBean private ApprovedSourceClient transport;

    @Test
    void retrievalReviewPublicationInteractionsAndRemovalUseRealApisAndDatabase() throws Exception {
        String unique = UUID.randomUUID().toString();
        String url = "https://www.dbm.gov.ph/article-" + unique;
        var source = new GovernmentSource();
        source.setName("Test fixture source " + unique);
        source.setBaseUrl("https://www.dbm.gov.ph/");
        source.setFeedUrl("https://www.dbm.gov.ph/test-feed-" + unique);
        source.setRetrievalType("RSS");
        source.setActive(true);
        sources.save(source);
        String date = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.now().atZone(ZoneOffset.UTC));
        String rss = "<rss><channel><item><title>National budget review</title><link>" + url
                + "</link><pubDate>" + date + "</pubDate></item></channel></rss>";
        String page = "<html><h1>National budget review</h1><article>"
                + "This is test fixture content describing a national budget review, not a factual government record. "
                + "It is used only in the isolated test database to verify extraction, review and publication behavior."
                + "</article></html>";
        when(transport.get(any(), any(URI.class))).thenAnswer(call -> {
            URI uri = call.getArgument(1);
            return new ApprovedSourceClient.Download(
                    (uri.toString().equals(source.getFeedUrl()) ? rss : page).getBytes(StandardCharsets.UTF_8),
                    "text/html", uri);
        });
        String admin = token("ADMIN");
        String user = token("CONTRIBUTOR");
        mvc.perform(post("/api/admin/news/fetch").header("Authorization", "Bearer " + user))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/news/fetch").header("Authorization", "Bearer " + admin))
                .andExpect(status().isAccepted());
        String state = "RUNNING";
        for (int attempt = 0; attempt < 100 && state.equals("RUNNING"); attempt++) {
            var result = mvc.perform(get("/api/admin/news/fetch-status").header("Authorization", "Bearer " + admin))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            state = json.readTree(result).path("state").asText();
            if (state.equals("RUNNING")) Thread.sleep(20);
        }
        org.junit.jupiter.api.Assertions.assertEquals("COMPLETED", state);
        String pending = mvc.perform(get("/api/admin/news?status=PENDING_REVIEW").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id = json.readTree(pending).path("content").get(0).path("id").asText();
        mvc.perform(get("/api/news/{id}", id)).andExpect(status().isNotFound());
        action(id, "publish", admin, 409);
        action(id, "process-ai", admin, 200);
        action(id, "approve", admin, 200);
        mvc.perform(get("/api/news/{id}", id)).andExpect(status().isNotFound());
        action(id, "publish", admin, 200);
        action(id, "approve", admin, 409);
        action(id, "process-ai", admin, 409);
        mvc.perform(get("/api/news/{id}", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewNotes").doesNotExist())
                .andExpect(jsonPath("$.extraction").isEmpty());
        mvc.perform(post("/api/news/{id}/comments", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Guest\"}")).andExpect(status().isUnauthorized());
        String comment = mvc.perform(post("/api/news/{id}/comments", id).header("Authorization", "Bearer " + user)
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Test comment\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authorLabel").value("Anonymous"))
                .andReturn().getResponse().getContentAsString();
        String commentId = json.readTree(comment).path("id").asText();
        for (int expected : new int[]{1, 0}) {
            mvc.perform(post("/api/comments/{id}/vote", commentId).header("Authorization", "Bearer " + user)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"voteType\":\"UP\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.upvotes").value(expected));
        }
        mvc.perform(post("/api/news/{id}/save", id).header("Authorization", "Bearer " + user))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/saved-posts").header("Authorization", "Bearer " + user))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        action(id, "unpublish", admin, 200);
        mvc.perform(get("/api/news/{id}", id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/news/{id}/comments", id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/saved-posts").header("Authorization", "Bearer " + user))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        action(id, "unpublish", admin, 409);
        action(id, "process-ai", admin, 200);
        mvc.perform(post("/api/admin/news/{id}/reject", id).header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Test rejection\"}"))
                .andExpect(status().isOk());
        action(id, "publish", admin, 409);
        mvc.perform(get("/api/news/{id}", id)).andExpect(status().isNotFound());
    }

    private void action(String id, String action, String token, int expected) throws Exception {
        mvc.perform(post("/api/admin/news/{id}/{action}", id, action).header("Authorization", "Bearer " + token))
                .andExpect(status().is(expected));
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
