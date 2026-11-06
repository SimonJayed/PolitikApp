package com.politikapp.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "app.rate-limiting.enabled=true",
    "app.rate-limiting.login-limit=5"
})
class RateLimiterAndActuatorTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InMemorySlidingWindowRateLimiter rateLimiter;

    @BeforeEach
    void resetLimiter() {
        rateLimiter.clear();
    }

    @Test
    void testRateLimiterUnitLogic_AllowsUpToLimitAndBlocksExcess() {
        String testKey = "client-127.0.0.1:TEST";
        int limit = 3;
        long window = 5000L;

        assertTrue(rateLimiter.tryAcquire(testKey, limit, window));
        assertTrue(rateLimiter.tryAcquire(testKey, limit, window));
        assertTrue(rateLimiter.tryAcquire(testKey, limit, window));
        // 4th request within window must be rejected
        assertFalse(rateLimiter.tryAcquire(testKey, limit, window));

        // Different key should still be allowed
        assertTrue(rateLimiter.tryAcquire("client-192.168.1.1:TEST", limit, window));
    }

    @Test
    void testRateLimiterPurgeAndMemorySafety() {
        rateLimiter.tryAcquire("key1", 5, 60000L);
        rateLimiter.tryAcquire("key2", 5, 60000L);
        assertEquals(2, rateLimiter.getTrackedKeyCount());

        rateLimiter.clear();
        assertEquals(0, rateLimiter.getTrackedKeyCount());
    }

    @Test
    void testActuatorHealthEndpoint_PubliclyAccessible() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void testRateLimitingFilter_Enforces429TooManyRequests() throws Exception {
        String loginPayload = "{\"identifier\": \"nonexistent_user\", \"password\": \"wrongpass\"}";

        // login-limit is set to 5 in TestPropertySource
        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginPayload))
                    .andExpect(result -> {
                        int status = result.getResponse().getStatus();
                        assertTrue(status != 429, "Request " + status + " should not be rate limited yet");
                    });
        }

        // 6th attempt must trigger 429 Too Many Requests
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.error").value("Too Many Requests"));
    }
}
