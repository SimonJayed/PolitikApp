package com.politikapp.backend.auth.controller;

import com.politikapp.backend.auth.dto.AuthDtos.AuthResponse;
import com.politikapp.backend.auth.dto.AuthDtos.ReputationHistoryEntry;
import com.politikapp.backend.auth.dto.AuthDtos.UpdateMeRequest;
import com.politikapp.backend.auth.dto.AuthDtos.UserResponse;
import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.auth.service.AuthService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {
    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(authService.me(principal));
    }

    @PutMapping("/me")
    public ResponseEntity<AuthResponse> updateMe(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody UpdateMeRequest request
    ) {
        return ResponseEntity.ok(authService.updateMe(principal, request));
    }

    @GetMapping("/me/history")
    public ResponseEntity<List<ReputationHistoryEntry>> myHistory(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(authService.getReputationHistory(principal));
    }
}
