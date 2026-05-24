package com.politikapp.backend.module1.service;

public record WikidataPoliticianData(
        String wikidataId,
        String fullName,
        String position,
        String partyAffiliation,
        String profileImageUrl,
        String sourceUrl
) {
}
