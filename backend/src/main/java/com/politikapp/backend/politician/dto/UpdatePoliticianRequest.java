package com.politikapp.backend.politician.dto;

public record UpdatePoliticianRequest(
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        String profileImageUrl,
        String biography
) {
}
