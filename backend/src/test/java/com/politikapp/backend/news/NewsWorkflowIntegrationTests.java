package com.politikapp.backend.news;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class NewsWorkflowIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private GovernmentSourceRepository sourceRepository;

    @Autowired
    private AuthUserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Test
    void newsMovesFromRetrievalToPublicationAndPublicInteraction() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String uniquePath = "/article-" + UUID.randomUUID();
        try {
            int port = server.getAddress().getPort();
            String baseUrl = "http://127.0.0.1:" + port;
            String articleUrl = baseUrl + uniquePath;
            String rss = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <rss version="2.0"><channel>
                      <title>Mock Government Source</title>
                      <item>
                        <title>Agency announces public infrastructure project</title>
                        <link>%s</link>
                        <pubDate>Tue, 13 Oct 2026 09:20:51 +0000</pubDate>
                        <description><![CDATA[The agency announced a public infrastructure project for admin verification.]]></description>
                      </item>
                    </channel></rss>
                    """.formatted(articleUrl);
            server.createContext("/feed", exchange -> {
                byte[] body = rss.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/rss+xml");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();

            GovernmentSource source = new GovernmentSource();
            source.setName("Mock Government Source " + UUID.randomUUID());
            source.setBaseUrl(baseUrl);
            source.setFeedUrl(baseUrl + "/feed");
            source.setRetrievalType("RSS");
            source.setActive(true);
            sourceRepository.save(source);

            AuthUser admin = saveUser("admin-" + UUID.randomUUID() + "@politikapp.test", "ADMIN");
            AuthUser contributor = saveUser("user-" + UUID.randomUUID() + "@politikapp.test", "CONTRIBUTOR");
            String adminToken = jwtService.generateAccessToken(admin.getUserId(), admin.getEmail(), admin.getRole());
            String userToken = jwtService.generateAccessToken(contributor.getUserId(), contributor.getEmail(), contributor.getRole());

            mockMvc.perform(post("/api/admin/news/fetch").header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.retrieved").value(1));

            mockMvc.perform(get("/api/admin/news/summary").header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.pendingReview", greaterThanOrEqualTo(1)))
                    .andExpect(jsonPath("$.publishedArticles").exists())
                    .andExpect(jsonPath("$.rejectedArticles").exists());

            mockMvc.perform(get("/api/admin/news/summary").header("Authorization", "Bearer " + userToken))
                    .andExpect(status().isForbidden());

            String pendingJson = mockMvc.perform(get("/api/admin/news?status=PENDING_REVIEW")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].status").value("PENDING_REVIEW"))
                    .andReturn().getResponse().getContentAsString();
            String articleId = objectMapper.readTree(pendingJson).at("/content/0/id").asText();

            mockMvc.perform(post("/api/admin/news/{id}/approve", articleId).header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("APPROVED"));
            mockMvc.perform(post("/api/admin/news/{id}/publish", articleId).header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("PUBLISHED"));

            mockMvc.perform(get("/api/news"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].id").value(articleId));

            String commentJson = mockMvc.perform(post("/api/news/{id}/comments", articleId)
                            .header("Authorization", "Bearer " + userToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"content\":\"This is an anonymous civic comment.\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.authorLabel").value("Anonymous"))
                    .andReturn().getResponse().getContentAsString();
            JsonNode comment = objectMapper.readTree(commentJson);

            mockMvc.perform(post("/api/comments/{id}/vote", comment.get("id").asText())
                            .header("Authorization", "Bearer " + userToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"voteType\":\"UP\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.score").value(1));
        } finally {
            server.stop(0);
        }
    }

    private AuthUser saveUser(String email, String role) {
        AuthUser user = new AuthUser();
        user.setUserId(UUID.randomUUID());
        user.setEmail(email);
        user.setUsername(email.substring(0, Math.min(email.indexOf("@"), 50)));
        user.setFullName(role + " Test User");
        user.setPasswordHash("hash");
        user.setRole(role);
        user.setAccountStatus("ACTIVE");
        return userRepository.save(user);
    }
}
