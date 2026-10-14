package com.politikapp.backend.auth.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final JdbcTemplate jdbcTemplate;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            JdbcTemplate jdbcTemplate
    ) {
        this.jwtService = jwtService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Claims claims = jwtService.parseToken(token);
                String tokenType = claims.get("typ", String.class);
                if (!JwtService.ACCESS_TOKEN_TYPE.equals(tokenType)) {
                    throw new IllegalArgumentException("Invalid token type for API authentication.");
                }
                UUID userId = UUID.fromString(claims.get("uid", String.class));

                // Real-time account lockout check
                String accountStatus = resolveAccountStatus(userId);
                if (accountStatus == null || "LOCKED".equals(accountStatus)) {
                    jakarta.servlet.http.HttpServletResponse res = (jakarta.servlet.http.HttpServletResponse) response;
                    res.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                    res.setContentType("application/json");
                    res.getWriter().write("{\"error\": \"Unauthorized\", \"message\": \"Account is locked or user no longer exists.\"}");
                    return;
                }

                AuthPrincipal principal = new AuthPrincipal(
                        userId,
                        claims.getSubject(),
                        claims.get("role", String.class)
                );
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
                );
            } catch (Exception exception) {
                logger.debug("JWT authentication failed: " + exception.getClass().getSimpleName());
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }

    private String resolveAccountStatus(UUID userId) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT account_status FROM users WHERE user_id = ?",
                    String.class,
                    userId
            );
        } catch (EmptyResultDataAccessException exception) {
            return null;
        }
    }
}
