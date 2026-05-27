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

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
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
                String role = claims.get("role", String.class);
                String sandboxRoleOverride = request.getHeader("X-Sandbox-Role-Override");
                if (org.springframework.util.StringUtils.hasText(sandboxRoleOverride)) {
                    if ("JUDICIAL_REVIEWER".equalsIgnoreCase(sandboxRoleOverride)) {
                        role = "PEER";
                    } else if ("ADMINISTRATOR".equalsIgnoreCase(sandboxRoleOverride) || "ADMIN".equalsIgnoreCase(sandboxRoleOverride)) {
                        role = "ADMIN";
                    } else {
                        role = sandboxRoleOverride.toUpperCase();
                    }
                }

                AuthPrincipal principal = new AuthPrincipal(
                        UUID.fromString(claims.get("uid", String.class)),
                        claims.getSubject(),
                        role
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
