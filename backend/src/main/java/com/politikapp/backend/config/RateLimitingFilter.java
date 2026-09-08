package com.politikapp.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter that applies sliding-window rate limiting to sensitive endpoints:
 * - /auth/login
 * - /auth/register
 * - /api/submissions (POST)
 * - /api/challenges (POST)
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimiter rateLimiter;

    @Value("${app.rate-limiting.enabled:true}")
    private boolean enabled;

    @Value("${app.rate-limiting.login-limit:60}")
    private int loginLimit;

    @Value("${app.rate-limiting.register-limit:20}")
    private int registerLimit;

    @Value("${app.rate-limiting.submission-limit:30}")
    private int submissionLimit;

    @Value("${app.rate-limiting.challenge-limit:30}")
    private int challengeLimit;

    public RateLimitingFilter(RateLimiter rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }

        String uri = request.getRequestURI();
        String method = request.getMethod();

        Integer limit = resolveLimit(uri, method);
        if (limit != null) {
            String clientIp = resolveClientIp(request);
            String rateLimitKey = clientIp + ":" + method + ":" + uri;

            // 60,000 ms = 1 minute sliding window
            boolean allowed = rateLimiter.tryAcquire(rateLimitKey, limit, 60_000L);
            if (!allowed) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", "60");
                response.getWriter().write("{\"error\": \"Too Many Requests\", \"message\": \"Rate limit exceeded. Please try again in a few moments.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private Integer resolveLimit(String uri, String method) {
        if (uri.startsWith("/auth/login")) {
            return loginLimit;
        }
        if (uri.startsWith("/auth/register")) {
            return registerLimit;
        }
        if ("POST".equalsIgnoreCase(method)) {
            if (uri.startsWith("/api/submissions")) {
                return submissionLimit;
            }
            if (uri.startsWith("/api/challenges")) {
                return challengeLimit;
            }
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
