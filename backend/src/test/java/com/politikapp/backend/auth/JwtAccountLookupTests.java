package com.politikapp.backend.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.auth.security.JwtAuthenticationFilter;
import com.politikapp.backend.auth.security.JwtService;
import io.jsonwebtoken.Claims;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAccountLookupTests {
    @AfterEach
    void clearContext() { SecurityContextHolder.clearContext(); }

    @Test
    void currentRoleAndStatusUseOneLookupAndDoNotTrustTheTokensOldRole() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var userId = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), eq(userId)))
                .thenReturn(List.of(Map.of("account_status", "ACTIVE", "role", "ADMIN")));
        var filter = filter(jdbc, userId);
        var response = new MockHttpServletResponse();
        filter.doFilter(request(), response, (req, res) -> {
            var principal = (AuthPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            assertTrue(principal.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));
        });
        verify(jdbc, times(1)).queryForList(anyString(), eq(userId));
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void lockedAndDeletedUsersAreRejectedWithoutCallingTheEndpoint() throws Exception {
        for (var rows : List.of(List.of(Map.<String, Object>of("account_status", "LOCKED", "role", "ADMIN")),
                List.<Map<String, Object>>of())) {
            var jdbc = mock(JdbcTemplate.class);
            var userId = UUID.randomUUID();
            when(jdbc.queryForList(anyString(), eq(userId))).thenReturn(rows);
            var response = new MockHttpServletResponse();
            filter(jdbc, userId).doFilter(request(), response, (req, res) -> fail("Endpoint must not run"));
            assertEquals(401, response.getStatus());
            assertNull(SecurityContextHolder.getContext().getAuthentication());
            verify(jdbc, times(1)).queryForList(anyString(), eq(userId));
        }
    }

    private JwtAuthenticationFilter filter(JdbcTemplate jdbc, UUID userId) {
        var jwt = mock(JwtService.class);
        var claims = mock(Claims.class);
        when(jwt.parseToken("fixture-token")).thenReturn(claims);
        when(claims.get("typ", String.class)).thenReturn(JwtService.ACCESS_TOKEN_TYPE);
        when(claims.get("uid", String.class)).thenReturn(userId.toString());
        when(claims.getSubject()).thenReturn("fixture@test.invalid");
        return new JwtAuthenticationFilter(jwt, jdbc);
    }

    private MockHttpServletRequest request() {
        var request = new MockHttpServletRequest("GET", "/api/admin/news");
        request.addHeader("Authorization", "Bearer fixture-token");
        return request;
    }
}
