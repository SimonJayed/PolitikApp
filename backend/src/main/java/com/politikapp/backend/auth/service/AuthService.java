package com.politikapp.backend.auth.service;

import com.politikapp.backend.auth.dto.AuthDtos.AuthResponse;
import com.politikapp.backend.auth.dto.AuthDtos.LoginRequest;
import com.politikapp.backend.auth.dto.AuthDtos.RefreshRequest;
import com.politikapp.backend.auth.dto.AuthDtos.RegisterRequest;
import com.politikapp.backend.auth.dto.AuthDtos.UpdateMeRequest;
import com.politikapp.backend.auth.dto.AuthDtos.UserResponse;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.common.HttpResponseException;
import java.util.UUID;
import java.util.List;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthService {
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private static final RowMapper<AuthUser> AUTH_USER_ROW_MAPPER = (rs, rowNum) -> {
        AuthUser user = new AuthUser();
        user.setUserId(rs.getObject("user_id", UUID.class));
        user.setFullName(rs.getString("full_name"));
        user.setEmail(rs.getString("email"));
        user.setUsername(rs.getString("username"));
        user.setPasswordHash(rs.getString("password_hash"));
        user.setRole(rs.getString("role"));
        user.setAccountStatus(rs.getString("account_status"));
        return user;
    };

    public AuthService(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (findByEmail(request.email().trim()) != null) {
            throw new HttpResponseException(409, "Email is already registered.");
        }
        if (findByUsername(request.username().trim()) != null) {
            throw new HttpResponseException(409, "Username is already taken.");
        }
        AuthUser user = new AuthUser();
        user.setUserId(UUID.randomUUID());
        user.setFullName(request.fullName().trim());
        user.setEmail(request.email().trim());
        user.setUsername(request.username().trim());
        user.setRole("CONTRIBUTOR");
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setAccountStatus("ACTIVE");
        insertUser(user);
        AuthUser saved = findById(user.getUserId());
        return toAuthResponse(saved);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String login = request.login().trim();
        AuthUser user = login.contains("@")
                ? findByEmail(login)
                : findByUsername(login);
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
        AuthUser user = findById(userId);
        if (user == null) {
            throw new HttpResponseException(401, "Invalid refresh token.");
        }
        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(AuthPrincipal principal) {
        AuthUser user = findById(principal.getUserId());
        if (user == null) {
            throw new HttpResponseException(404, "User not found.");
        }
        return toSafeUser(user);
    }

    @Transactional
    public AuthResponse updateMe(AuthPrincipal principal, UpdateMeRequest request) {
        AuthUser user = findById(principal.getUserId());
        if (user == null) {
            throw new HttpResponseException(404, "User not found.");
        }
        if (StringUtils.hasText(request.username())
                && !request.username().trim().equalsIgnoreCase(user.getUsername())
                && findByUsername(request.username().trim()) != null) {
            throw new HttpResponseException(409, "Username is already taken.");
        }
        if (StringUtils.hasText(request.fullName())) {
            user.setFullName(request.fullName().trim());
        }
        if (StringUtils.hasText(request.username())) {
            user.setUsername(request.username().trim());
        }
        jdbcTemplate.update(
                "UPDATE users SET full_name = ?, username = ? WHERE user_id = ?",
                user.getFullName(),
                user.getUsername(),
                user.getUserId()
        );
        AuthUser saved = findById(user.getUserId());

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

    private AuthUser findByEmail(String email) {
        return findOne(
                "SELECT user_id, full_name, email, username, password_hash, role, account_status FROM users WHERE lower(email) = lower(?)",
                email
        );
    }

    private AuthUser findByUsername(String username) {
        return findOne(
                "SELECT user_id, full_name, email, username, password_hash, role, account_status FROM users WHERE lower(username) = lower(?)",
                username
        );
    }

    private AuthUser findById(UUID userId) {
        return findOne(
                "SELECT user_id, full_name, email, username, password_hash, role, account_status FROM users WHERE user_id = ?",
                userId
        );
    }

    private AuthUser findOne(String sql, Object parameter) {
        try {
            return jdbcTemplate.queryForObject(sql, AUTH_USER_ROW_MAPPER, parameter);
        } catch (EmptyResultDataAccessException exception) {
            return null;
        }
    }

    private void insertUser(AuthUser user) {
        jdbcTemplate.update(
                """
                        INSERT INTO users
                            (user_id, full_name, email, username, password_hash, role, account_status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                user.getUserId(),
                user.getFullName(),
                user.getEmail(),
                user.getUsername(),
                user.getPasswordHash(),
                user.getRole(),
                user.getAccountStatus()
        );
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
                user.getCreatedAt()
        );
    }

}
