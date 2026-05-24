package com.politikapp.backend.module1.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.WikidataImportResponse;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class WikidataService {
    private static final String WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
    private static final String USER_AGENT = "PolitikApp/1.0 (student project)";
    private static final String UNKNOWN_POSITION = "UNKNOWN";
    private static final String NATIONAL_JURISDICTION = "NATIONAL";
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String WIKIDATA_QUERY = """
            SELECT ?person ?personLabel ?positionLabel ?partyLabel ?image WHERE {
              ?person wdt:P31 wd:Q5;
                      wdt:P27 wd:Q928;
                      wdt:P106 wd:Q82955.

              OPTIONAL { ?person wdt:P39 ?position. }
              OPTIONAL { ?person wdt:P102 ?party. }
              OPTIONAL { ?person wdt:P18 ?image. }

              SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 50
            """;

    private final RestClient restClient;
    private final PoliticianRepository politicianRepository;
    private final WikipediaService wikipediaService;

    public WikidataService(
            RestClient.Builder restClientBuilder,
            PoliticianRepository politicianRepository,
            WikipediaService wikipediaService
    ) {
        this.restClient = restClientBuilder.build();
        this.politicianRepository = politicianRepository;
        this.wikipediaService = wikipediaService;
    }

    @Transactional
    public WikidataImportResponse importPoliticians() {
        List<WikidataPoliticianData> politicians = fetchPoliticiansFromWikidata();
        int savedCount = 0;

        for (WikidataPoliticianData data : politicians) {
            upsertPolitician(data);
            savedCount++;
        }

        return new WikidataImportResponse(
                savedCount,
                "Wikidata import completed. Politicians were saved or updated."
        );
    }

    private List<WikidataPoliticianData> fetchPoliticiansFromWikidata() {
        try {
            JsonNode response = restClient.post()
                    .uri(WIKIDATA_SPARQL_URL)
                    .header(HttpHeaders.CONTENT_TYPE, "application/sparql-query")
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.USER_AGENT, USER_AGENT)
                    .body(WIKIDATA_QUERY)
                    .retrieve()
                    .body(JsonNode.class);

            return parseWikidataResponse(response);
        } catch (RestClientException exception) {
            throw new HttpResponseException(503, "Service Unavailable: Wikidata import request failed.");
        }
    }

    private List<WikidataPoliticianData> parseWikidataResponse(JsonNode response) {
        List<WikidataPoliticianData> politicians = new ArrayList<>();
        JsonNode bindings = response == null ? null : response.path("results").path("bindings");

        if (bindings == null || !bindings.isArray()) {
            return politicians;
        }

        for (JsonNode binding : bindings) {
            String personUrl = valueOf(binding, "person");
            String wikidataId = extractWikidataId(personUrl);
            String fullName = valueOf(binding, "personLabel");

            if (wikidataId == null || fullName == null || fullName.isBlank()) {
                continue;
            }

            politicians.add(new WikidataPoliticianData(
                    wikidataId,
                    fullName,
                    fallback(valueOf(binding, "positionLabel"), UNKNOWN_POSITION),
                    valueOf(binding, "partyLabel"),
                    valueOf(binding, "image"),
                    personUrl
            ));
        }

        return politicians;
    }

    private void upsertPolitician(WikidataPoliticianData data) {
        Politician politician = politicianRepository.findByWikidataId(data.wikidataId())
                .orElseGet(Politician::new);
        Optional<WikipediaSummary> wikipediaSummary = wikipediaService.getSummary(data.fullName());

        politician.setWikidataId(data.wikidataId());
        politician.setFullName(limit(data.fullName(), 150));
        politician.setPosition(limit(data.position(), 100));
        politician.setJurisdiction(NATIONAL_JURISDICTION);
        politician.setPartyAffiliation(limit(data.partyAffiliation(), 100));
        politician.setProfileImageUrl(firstPresent(data.profileImageUrl(), wikipediaSummary
                .map(WikipediaSummary::thumbnailUrl)
                .orElse(null)));
        politician.setBiography(wikipediaSummary
                .map(WikipediaSummary::biography)
                .orElse(politician.getBiography()));
        politician.setSourceUrl(data.sourceUrl());
        politician.setStatus(ACTIVE_STATUS);
        politician.setLastSyncedAt(Instant.now());

        politicianRepository.save(politician);
    }

    private String valueOf(JsonNode binding, String fieldName) {
        JsonNode valueNode = binding.path(fieldName).path("value");
        if (valueNode.isMissingNode() || valueNode.isNull()) {
            return null;
        }
        return valueNode.asText();
    }

    private String extractWikidataId(String personUrl) {
        if (personUrl == null || personUrl.isBlank()) {
            return null;
        }
        int lastSlashIndex = personUrl.lastIndexOf('/');
        if (lastSlashIndex < 0 || lastSlashIndex == personUrl.length() - 1) {
            return null;
        }
        return personUrl.substring(lastSlashIndex + 1);
    }

    private String fallback(String value, String fallbackValue) {
        if (value == null || value.isBlank()) {
            return fallbackValue;
        }
        return value;
    }

    private String firstPresent(String firstValue, String secondValue) {
        if (firstValue != null && !firstValue.isBlank()) {
            return firstValue;
        }
        return secondValue;
    }

    private String limit(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
