package com.politikapp.backend.auth.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final com.politikapp.backend.auth.repository.AuthUserRepository authUserRepository;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            com.politikapp.backend.auth.repository.AuthUserRepository authUserRepository
    ) {
        this.jwtService = jwtService;
        this.authUserRepository = authUserRepository;
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
                com.politikapp.backend.auth.entity.AuthUser user = authUserRepository.findById(userId).orElse(null);
                if (user == null || "LOCKED".equals(user.getAccountStatus())) {
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
            } catch (Exception ignored) {
                logger.error("JWT authentication failed: " + ignored.getMessage(), ignored);
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
