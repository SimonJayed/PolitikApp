package com.politikapp.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public class AuthDtos {
    public record RegisterRequest(
            @NotBlank(message = "name is required.") @Size(max = 150, message = "name must be at most 150 characters.") String fullName,
            @NotBlank(message = "email is required.") @Email(message = "email must be a valid email address.") @Size(max = 150, message = "email must be at most 150 characters.") String email,
            @NotBlank(message = "password is required.")
            @Size(min = 8, max = 120, message = "password must be between 8 and 120 characters.")
            @Pattern.List({
                    @Pattern(regexp = ".*[a-z].*", message = "password must include a lowercase letter."),
                    @Pattern(regexp = ".*[A-Z].*", message = "password must include an uppercase letter."),
                    @Pattern(regexp = ".*\\d.*", message = "password must include a number."),
                    @Pattern(regexp = ".*[^A-Za-z0-9\\s].*", message = "password must include a special character."),
                    @Pattern(regexp = "^\\S+$", message = "password cannot contain spaces.")
            })
            String password,
            @Size(max = 50) String role
    ) {}

    public record LoginRequest(
            @NotBlank(message = "email is required.") String login,
            @NotBlank(message = "password is required.") String password
    ) {}

    public record UpdateMeRequest(
            @Size(max = 150) String fullName,
            @Size(max = 50) String role,
            @Size(max = 50) String accountStatus
    ) {}

    public record UserResponse(
            UUID userId,
            String fullName,
            String email,
            String username,
            String role,
            String accountStatus,
            Instant createdAt
    ) {}

    public record AuthResponse(
            String token,
            String refreshToken,
            long expiresInSeconds,
            UserResponse user
    ) {}

    public record RefreshRequest(
            @NotBlank String refreshToken
    ) {}
}
