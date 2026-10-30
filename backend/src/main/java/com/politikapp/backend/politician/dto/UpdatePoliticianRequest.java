package com.politikapp.backend.politician.dto;

public record UpdatePoliticianRequest(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 150) String fullName,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100) String position,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100) String jurisdiction,
        @jakarta.validation.constraints.Size(max = 100) String partyAffiliation,
        @jakarta.validation.constraints.Size(max = 2048) String profileImageUrl,
        @jakarta.validation.constraints.Size(max = 10000) String biography
) {
}
