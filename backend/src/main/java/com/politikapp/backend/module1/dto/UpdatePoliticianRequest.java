package com.politikapp.backend.module1.dto;

public record UpdatePoliticianRequest(
        String fullName,
        String position,
        String jurisdiction,
        String partyAffiliation,
        String profileImageUrl,
        String biography
) {
}
