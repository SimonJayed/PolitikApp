package com.politikapp.backend.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    public static final String ACCESS_TOKEN_TYPE = "access";
    public static final String REFRESH_TOKEN_TYPE = "refresh";

    private final SecretKey secretKey;
    private final long accessExpirationSeconds;
    private final long refreshExpirationSeconds;

    public JwtService(
            @Value("${app.auth.jwt.secret:politikapp-super-secret-key-must-be-at-least-32-bytes}") String secret,
            @Value("${app.auth.jwt.expiration-seconds:3600}") long accessExpirationSeconds,
            @Value("${app.auth.jwt.refresh-expiration-seconds:1209600}") long refreshExpirationSeconds
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationSeconds = accessExpirationSeconds;
        this.refreshExpirationSeconds = refreshExpirationSeconds;
    }

    public String generateAccessToken(UUID userId, String email, String role) {
        return generateToken(userId, email, role, ACCESS_TOKEN_TYPE, accessExpirationSeconds);
    }

    public String generateRefreshToken(UUID userId, String email, String role) {
        return generateToken(userId, email, role, REFRESH_TOKEN_TYPE, refreshExpirationSeconds);
    }

    public long getAccessExpirationSeconds() {
        return accessExpirationSeconds;
    }

    private String generateToken(UUID userId, String email, String role, String tokenType, long expirationSeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(email)
                .claim("uid", userId.toString())
                .claim("role", role)
                .claim("typ", tokenType)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirationSeconds)))
                .signWith(secretKey)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token).getPayload();
    }
}
