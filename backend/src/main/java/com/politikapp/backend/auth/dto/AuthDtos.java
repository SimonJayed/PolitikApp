package com.politikapp.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public class AuthDtos {
    public record RegisterRequest(
            @NotBlank(message = "full_name is required.") @Size(max = 150, message = "full_name must be at most 150 characters.") String fullName,
            @NotBlank(message = "email is required.") @Email(message = "email must be a valid email address.") @Size(max = 150, message = "email must be at most 150 characters.") String email,
            @NotBlank(message = "username is required.") @Size(min = 3, max = 80, message = "username must be between 3 and 80 characters.") String username,
            @NotBlank(message = "password is required.") @Size(min = 8, max = 120, message = "password must be between 8 and 120 characters.") String password,
            @Size(max = 50) String role
    ) {}

    public record LoginRequest(
            @NotBlank String login,
            @NotBlank String password
    ) {}

    public record UpdateMeRequest(
            @Size(max = 150) String fullName,
            @Size(max = 80) String username
    ) {}

    public record UserResponse(
            UUID userId,
            String fullName,
            String email,
            String username,
            String role,
            Instant createdAt
    ) {}

    public record AuthResponse(
            String token,
            UserResponse user
    ) {}
}
