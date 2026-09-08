package com.politikapp.backend.auth.service;

import com.politikapp.backend.auth.dto.AuthDtos.AuthResponse;
import com.politikapp.backend.auth.dto.AuthDtos.LoginRequest;
import com.politikapp.backend.auth.dto.AuthDtos.RefreshRequest;
import com.politikapp.backend.auth.dto.AuthDtos.RegisterRequest;
import com.politikapp.backend.auth.dto.AuthDtos.ReputationHistoryEntry;
import com.politikapp.backend.auth.dto.AuthDtos.UpdateMeRequest;
import com.politikapp.backend.auth.dto.AuthDtos.UserResponse;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.common.HttpResponseException;
import java.util.Locale;
import java.util.UUID;
import java.util.List;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import jakarta.persistence.EntityManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthService {
    private static final BigDecimal MIN_TRUST_SCORE = BigDecimal.ZERO;
    private static final BigDecimal MAX_TRUST_SCORE = BigDecimal.valueOf(500.00);

    private final AuthUserRepository authUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EntityManager entityManager;

    public AuthService(
            AuthUserRepository authUserRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EntityManager entityManager
    ) {
        this.authUserRepository = authUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.entityManager = entityManager;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (authUserRepository.findByEmailIgnoreCase(request.email().trim()).isPresent()) {
            throw new HttpResponseException(409, "Email is already registered.");
        }
        if (authUserRepository.findByUsernameIgnoreCase(request.username().trim()).isPresent()) {
            throw new HttpResponseException(409, "Username is already taken.");
        }
        String role = StringUtils.hasText(request.role()) ? request.role().trim().toUpperCase(Locale.ROOT) : "CONTRIBUTOR";
        AuthUser user = new AuthUser();
        user.setUserId(UUID.randomUUID());
        user.setFullName(request.fullName().trim());
        user.setEmail(request.email().trim());
        user.setUsername(request.username().trim());
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        AuthUser saved = authUserRepository.save(user);
        return toAuthResponse(saved);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String login = request.login().trim();
        AuthUser user = login.contains("@")
                ? authUserRepository.findByEmailIgnoreCase(login).orElse(null)
                : authUserRepository.findByUsernameIgnoreCase(login).orElse(null);
        if (user == null || !StringUtils.hasText(user.getPasswordHash()) || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new HttpResponseException(401, "Invalid credentials.");
        }
        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshRequest request) {
        var claims = jwtService.parseToken(request.refreshToken().trim());
        String tokenType = claims.get("typ", String.class);
        if (!JwtService.REFRESH_TOKEN_TYPE.equals(tokenType)) {
            throw new HttpResponseException(401, "Invalid refresh token.");
        }
        UUID userId = UUID.fromString(claims.get("uid", String.class));
        AuthUser user = authUserRepository.findById(userId)
                .orElseThrow(() -> new HttpResponseException(401, "Invalid refresh token."));
        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(AuthPrincipal principal) {
        AuthUser user = authUserRepository.findById(principal.getUserId())
                .orElseThrow(() -> new HttpResponseException(404, "User not found."));
        return toSafeUser(user);
    }

    @Transactional
    public AuthResponse updateMe(AuthPrincipal principal, UpdateMeRequest request) {
        AuthUser user = authUserRepository.findById(principal.getUserId())
                .orElseThrow(() -> new HttpResponseException(404, "User not found."));
        if (StringUtils.hasText(request.username())
                && !request.username().trim().equalsIgnoreCase(user.getUsername())
                && authUserRepository.findByUsernameIgnoreCase(request.username().trim()).isPresent()) {
            throw new HttpResponseException(409, "Username is already taken.");
        }
        if (StringUtils.hasText(request.fullName())) {
            user.setFullName(request.fullName().trim());
        }
        if (StringUtils.hasText(request.username())) {
            user.setUsername(request.username().trim());
        }
        if (request.sandboxProfileMetrics() != null) {
            user.setSandboxProfileMetrics(request.sandboxProfileMetrics());
        }
        
        AuthUser saved = authUserRepository.save(user);

        // Retain verified database role in the active security context container in-memory
        String securityRole = "ROLE_" + saved.getRole();
        List<SimpleGrantedAuthority> newAuthorities = List.of(new SimpleGrantedAuthority(securityRole));

        UsernamePasswordAuthenticationToken newAuth = new UsernamePasswordAuthenticationToken(
            new AuthPrincipal(saved.getUserId(), saved.getEmail(), saved.getRole()),
            SecurityContextHolder.getContext().getAuthentication() != null ?
                SecurityContextHolder.getContext().getAuthentication().getCredentials() : null,
            newAuthorities
        );
        SecurityContextHolder.getContext().setAuthentication(newAuth);

        return toAuthResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReputationHistoryEntry> getReputationHistory(AuthPrincipal principal) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT log_id, queue_id, score_change, previous_score, new_score, reason, created_at " +
                "FROM public.reputation_audit_logs " +
                "WHERE peer_id = :userId " +
                "ORDER BY created_at DESC"
        )
                .setParameter("userId", principal.getUserId())
                .getResultList();

        return rows.stream()
                .map(this::toHistoryEntry)
                .toList();
    }

    private AuthResponse toAuthResponse(AuthUser user) {
        String token = jwtService.generateAccessToken(user.getUserId(), user.getEmail(), user.getRole());
        String refreshToken = jwtService.generateRefreshToken(user.getUserId(), user.getEmail(), user.getRole());
        return new AuthResponse(token, refreshToken, jwtService.getAccessExpirationSeconds(), toSafeUser(user));
    }

    private UserResponse toSafeUser(AuthUser user) {
        return new UserResponse(
                user.getUserId(),
                user.getFullName(),
                user.getEmail(),
                user.getUsername(),
                user.getRole(),
                user.getAccountStatus(),
                user.getWritingTokenStatus(),
                user.getTrustScore(),
                user.getSandboxProfileMetrics(),
                user.getCreatedAt()
        );
    }

    private BigDecimal clampTrustScore(BigDecimal trustScore) {
        return trustScore.max(MIN_TRUST_SCORE).min(MAX_TRUST_SCORE);
    }

    private ReputationHistoryEntry toHistoryEntry(Object[] row) {
        UUID logId = row[0] != null ? UUID.fromString(row[0].toString()) : null;
        UUID queueId = row[1] != null ? UUID.fromString(row[1].toString()) : null;
        BigDecimal scoreChange = (BigDecimal) row[2];
        BigDecimal previousScore = (BigDecimal) row[3];
        BigDecimal newScore = (BigDecimal) row[4];
        String reason = row[5] != null ? row[5].toString() : null;
        Instant createdAt = row[6] instanceof Timestamp ts ? ts.toInstant() : null;

        return new ReputationHistoryEntry(
                logId,
                queueId,
                scoreChange,
                previousScore,
                newScore,
                reason,
                createdAt
        );
    }
}
