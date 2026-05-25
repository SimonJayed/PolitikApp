package com.politikapp.backend.auth.service;

import com.politikapp.backend.auth.dto.AuthDtos.AuthResponse;
import com.politikapp.backend.auth.dto.AuthDtos.LoginRequest;
import com.politikapp.backend.auth.dto.AuthDtos.RegisterRequest;
import com.politikapp.backend.auth.dto.AuthDtos.UpdateMeRequest;
import com.politikapp.backend.auth.dto.AuthDtos.UserResponse;
import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.auth.security.JwtService;
import com.politikapp.backend.common.HttpResponseException;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthService {
    private final AuthUserRepository authUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(AuthUserRepository authUserRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.authUserRepository = authUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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
    public UserResponse me(AuthPrincipal principal) {
        AuthUser user = authUserRepository.findById(principal.getUserId())
                .orElseThrow(() -> new HttpResponseException(404, "User not found."));
        return toSafeUser(user);
    }

    @Transactional
    public UserResponse updateMe(AuthPrincipal principal, UpdateMeRequest request) {
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
        return toSafeUser(authUserRepository.save(user));
    }

    private AuthResponse toAuthResponse(AuthUser user) {
        String token = jwtService.generateToken(user.getUserId(), user.getEmail(), user.getRole());
        return new AuthResponse(token, toSafeUser(user));
    }

    private UserResponse toSafeUser(AuthUser user) {
        return new UserResponse(
                user.getUserId(),
                user.getFullName(),
                user.getEmail(),
                user.getUsername(),
                user.getRole(),
                user.getCreatedAt()
        );
    }
}
