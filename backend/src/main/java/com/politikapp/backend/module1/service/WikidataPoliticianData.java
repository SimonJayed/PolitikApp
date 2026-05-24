package com.politikapp.backend.module1.service;

import java.time.LocalDate;

public record WikidataPoliticianData(
        String wikidataId,
        String fullName,
        String position,
        String partyAffiliation,
        String profileImageUrl,
        String sourceUrl,
        LocalDate termStart,
        LocalDate termEnd,
        String jurisdiction
) {
}
