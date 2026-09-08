package com.politikapp.backend.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.JwtService;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityHardeningTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthUserRepository authUserRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private AuthUser contributorUser;
    private String contributorToken;

    @BeforeEach
    void setupUser() {
        UUID userId = UUID.fromString("11111111-2222-3333-4444-555555555555");
        contributorUser = authUserRepository.findById(userId).orElseGet(() -> {
            AuthUser user = new AuthUser();
            user.setUserId(userId);
            user.setEmail("test.contributor@politikapp.com");
            user.setUsername("test_contrib");
            user.setFullName("Test Contributor");
            user.setPasswordHash(passwordEncoder.encode("password123"));
            user.setRole("CONTRIBUTOR");
            user.setAccountStatus("ACTIVE");
            user.setWritingTokenStatus("ACTIVE");
            user.setTrustScore(new BigDecimal("50.00"));
            return authUserRepository.save(user);
        });

        // Ensure role is reset to CONTRIBUTOR before each test
        contributorUser.setRole("CONTRIBUTOR");
        contributorUser.setTrustScore(new BigDecimal("50.00"));
        authUserRepository.save(contributorUser);

        contributorToken = jwtService.generateAccessToken(
                contributorUser.getUserId(),
                contributorUser.getEmail(),
                contributorUser.getRole()
        );
    }

    @Test
    void testPutUsersMeCannotSelfPromoteRoleOrTrustScore() throws Exception {
        mockMvc.perform(put("/users/me")
                        .header("Authorization", "Bearer " + contributorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Updated Contributor",
                                  "role": "ADMIN",
                                  "trustScore": 100.0,
                                  "accountStatus": "SUSPENDED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.fullName").value("Updated Contributor"))
                .andExpect(jsonPath("$.user.role").value("CONTRIBUTOR"))
                .andExpect(jsonPath("$.user.trustScore").value(50.0));

        AuthUser refreshed = authUserRepository.findById(contributorUser.getUserId()).orElseThrow();
        assertEquals("CONTRIBUTOR", refreshed.getRole());
        assertEquals(new BigDecimal("50.00"), refreshed.getTrustScore());
        assertEquals("ACTIVE", refreshed.getAccountStatus());
    }

    @Test
    void testSandboxRoleOverrideIsIgnoredByDefault() throws Exception {
        // Contributor attempts to access admin-only endpoint using X-Sandbox-Role-Override header
        mockMvc.perform(get("/api/admin/adjudication/queue")
                        .header("Authorization", "Bearer " + contributorToken)
                        .header("X-Sandbox-Role-Override", "ADMIN"))
                .andExpect(status().isForbidden());
    }

    @Test
    void testSecurityResponseHeadersArePresent() throws Exception {
        mockMvc.perform(get("/api/politicians"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }
}
