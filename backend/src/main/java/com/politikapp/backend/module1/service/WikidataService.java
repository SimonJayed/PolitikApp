package com.politikapp.backend.module1.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.dto.WikidataImportResponse;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class WikidataService {
    private static final Logger log = LoggerFactory.getLogger(WikidataService.class);
    private static final String WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
    private static final String USER_AGENT = "PolitikApp/1.0 (student project)";
    private static final String UNKNOWN_POSITION = "UNKNOWN";
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String NATIONAL_QUERY = """
            PREFIX wd: <http://www.wikidata.org/entity/>
            PREFIX wdt: <http://www.wikidata.org/prop/direct/>
            PREFIX p: <http://www.wikidata.org/prop/>
            PREFIX ps: <http://www.wikidata.org/prop/statement/>
            PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            SELECT DISTINCT ?person ?personLabel ?positionLabel ?partyLabel ?image ?termStart ?termEnd WHERE {
              ?person wdt:P31 wd:Q5;
                      wdt:P27 wd:Q928.
              
              # National-Level Positions Only (Senate, House of Reps, Vice Pres, Pres)
              ?person p:P39 ?posStatement.
              ?posStatement ps:P39 ?position.
              FILTER(?position IN (wd:Q21074120, wd:Q21074121, wd:Q2723485, wd:Q1209571))
              
              ?posStatement pq:P580 ?termStart.
              # Filter for May 2022 - present
              FILTER(YEAR(?termStart) > 2022 || (YEAR(?termStart) = 2022 && MONTH(?termStart) >= 5))
              
              OPTIONAL { ?posStatement pq:P582 ?termEnd. }
              
              ?position rdfs:label ?positionLabel. FILTER(lang(?positionLabel) = "en")
              OPTIONAL { ?person wdt:P102 ?party. ?party rdfs:label ?partyLabel. FILTER(lang(?partyLabel) = "en") }
              OPTIONAL { ?person wdt:P18 ?image. }
              
              SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 20
            """;

    private static final String CEBU_QUERY = """
            PREFIX wd: <http://www.wikidata.org/entity/>
            PREFIX wdt: <http://www.wikidata.org/prop/direct/>
            PREFIX p: <http://www.wikidata.org/prop/>
            PREFIX ps: <http://www.wikidata.org/prop/statement/>
            PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            SELECT DISTINCT ?person ?personLabel ?positionLabel ?partyLabel ?image ?termStart ?termEnd WHERE {
              ?person wdt:P31 wd:Q5;
                      wdt:P27 wd:Q928.
              
              # Cebu City Local Positions (Bound tightly by Location or Jurisdiction without spaces)
              ?person p:P39 ?posStatement.
              ?posStatement ps:P39 ?position.
              
              ?position (wdt:P131|wdt:P1001) wd:Q1467.
              
              ?posStatement pq:P580 ?termStart.
              OPTIONAL { ?posStatement pq:P582 ?termEnd. }
              
              # Filter for active terms only using native SPARQL NOW function
              FILTER(!bound(?termEnd) || ?termEnd >= NOW())
              
              ?position rdfs:label ?positionLabel. FILTER(lang(?positionLabel) = "en")
              OPTIONAL { ?person wdt:P102 ?party. ?party rdfs:label ?partyLabel. FILTER(lang(?partyLabel) = "en") }
              OPTIONAL { ?person wdt:P18 ?image. }
              
              SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 20
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
        log.info("--- Starting Multi-Scope Wikidata Ingestion Cycle ---");
        int savedCount = 0;

        try {
            // Pass 1: Run and process National leaders
            log.info("Executing Pass 1/2: National-Level Politicians Ingestion");
            List<WikidataPoliticianData> nationalLeaders = fetchFromWikidataEndpoint(NATIONAL_QUERY, "NATIONAL");
            log.info("Pass 1 fetched {} candidate records from Wikidata", nationalLeaders.size());
            for (WikidataPoliticianData data : nationalLeaders) {
                try {
                    upsertPolitician(data);
                    savedCount++;
                } catch (Exception e) {
                    log.error("Failed to upsert national politician profile for '{}': {}", data.fullName(), e.getMessage());
                }
            }

            // Pass 2: Run and process Cebu City local leaders
            log.info("Executing Pass 2/2: Cebu City Local Politicians Ingestion");
            List<WikidataPoliticianData> cebuLeaders = fetchFromWikidataEndpoint(CEBU_QUERY, "CEBU_CITY");
            log.info("Pass 2 fetched {} candidate records from Wikidata", cebuLeaders.size());
            for (WikidataPoliticianData data : cebuLeaders) {
                try {
                    upsertPolitician(data);
                    savedCount++;
                } catch (Exception e) {
                    log.error("Failed to upsert Cebu local politician profile for '{}': {}", data.fullName(), e.getMessage());
                }
            }

            log.info("--- Wikidata Ingestion Cycle Finalized. Total successfully saved/updated: {} ---", savedCount);
        } catch (Exception e) {
            log.error("Global failure in Wikidata ingestion orchestration flow", e);
            throw e;
        }

        return new WikidataImportResponse(
                savedCount,
                "Independent multi-scope Wikidata ingestion cycle finalized successfully. Total processed: " + savedCount
        );
    }

    private List<WikidataPoliticianData> fetchFromWikidataEndpoint(String queryString, String targetedJurisdiction) {
        log.info("Sending HTTP SPARQL POST request to Wikidata endpoint for: {}", targetedJurisdiction);
        log.debug("SPARQL Query being sent:\n{}", queryString);
        try {
            JsonNode response = restClient.post()
                    .uri(WIKIDATA_SPARQL_URL)
                    .header(HttpHeaders.CONTENT_TYPE, "application/sparql-query")
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.USER_AGENT, USER_AGENT)
                    .body(queryString)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                log.warn("Received completely empty (null) JSON payload from Wikidata for: {}", targetedJurisdiction);
            } else {
                log.info("Successfully received JSON response back from Wikidata for: {}", targetedJurisdiction);
                if (log.isDebugEnabled()) {
                    log.debug("Raw Wikidata response JSON snippet: {}", response.toString().substring(0, Math.min(response.toString().length(), 1000)));
                }
            }

            return parseIndependentResponse(response, targetedJurisdiction);
        } catch (RestClientException exception) {
            log.error("RestClientException occurred during Wikidata communication for: {}. Message: {}", targetedJurisdiction, exception.getMessage(), exception);
            throw new HttpResponseException(503, "Service Unavailable: Wikidata connection dropped. Error: " + exception.getMessage());
        } catch (Exception exception) {
            log.error("Unexpected exception during Wikidata communication for: {}. Message: {}", targetedJurisdiction, exception.getMessage(), exception);
            throw exception;
        }
    }

    private List<WikidataPoliticianData> parseIndependentResponse(JsonNode response, String runtimeJurisdiction) {
        List<WikidataPoliticianData> politicians = new ArrayList<>();
        JsonNode bindings = response == null ? null : response.path("results").path("bindings");

        if (bindings == null || !bindings.isArray()) {
            log.warn("No 'results.bindings' JSON array found in the response for: {}", runtimeJurisdiction);
            return politicians;
        }

        log.info("Parsing {} raw bindings returned in SPARQL response for: {}", bindings.size(), runtimeJurisdiction);
        int parsedSuccessfully = 0;
        int skippedCount = 0;

        for (JsonNode binding : bindings) {
            String personUrl = valueOf(binding, "person");
            String wikidataId = extractWikidataId(personUrl);
            String fullName = valueOf(binding, "personLabel");

            if (wikidataId == null || fullName == null || fullName.isBlank()) {
                log.debug("Skipping binding due to missing mandatory identifiers: personUrl={}, wikidataId={}, fullName={}", 
                        personUrl, wikidataId, fullName);
                skippedCount++;
                continue;
            }

            String termStartStr = valueOf(binding, "termStart");
            LocalDate termStart = null;
            if (termStartStr != null && termStartStr.length() >= 4) {
                try {
                    String cleanDate = termStartStr.split("T")[0];
                    if (cleanDate.length() == 4) {
                        termStart = LocalDate.of(Integer.parseInt(cleanDate), 1, 1);
                    } else {
                        termStart = LocalDate.parse(cleanDate);
                    }
                } catch (Exception e) {
                    log.warn("Could not parse start term string '{}' for {}: {}", termStartStr, fullName, e.getMessage());
                }
            }

            String termEndStr = valueOf(binding, "termEnd");
            LocalDate termEnd = null;
            if (termEndStr != null && termEndStr.length() >= 4) {
                try {
                    String cleanDate = termEndStr.split("T")[0];
                    if (cleanDate.length() == 4) {
                        termEnd = LocalDate.of(Integer.parseInt(cleanDate), 1, 1);
                    } else {
                        termEnd = LocalDate.parse(cleanDate);
                    }
                } catch (Exception e) {
                    log.warn("Could not parse end term string '{}' for {}: {}", termEndStr, fullName, e.getMessage());
                }
            }

            String positionLabel = fallback(valueOf(binding, "positionLabel"), UNKNOWN_POSITION);
            String partyLabel = valueOf(binding, "partyLabel");
            String image = valueOf(binding, "image");

            log.debug("Parsed candidate item details: Name='{}', QID={}, Position='{}', Term=[{} -> {}]", 
                    fullName, wikidataId, positionLabel, termStart, termEnd);

            politicians.add(new WikidataPoliticianData(
                    wikidataId,
                    fullName,
                    positionLabel,
                    partyLabel,
                    image,
                    personUrl,
                    termStart,
                    termEnd,
                    runtimeJurisdiction
            ));
            parsedSuccessfully++;
        }

        log.info("Finished parsing for {}: Successfully mapped = {}, Skipped = {}", 
                runtimeJurisdiction, parsedSuccessfully, skippedCount);
        return politicians;
    }

    private void upsertPolitician(WikidataPoliticianData data) {
        log.info("Initiating DB upsert for politician profile: '{}' [{}]", data.fullName(), data.jurisdiction());
        
        Politician politician = politicianRepository.findByFullName(data.fullName())
                .orElseGet(() -> {
                    log.info("No existing DB record found for '{}'. Instantiating a new Politician entity.", data.fullName());
                    return new Politician();
                });

        if (politician.getPoliticianId() != null) {
            log.info("Existing profile found for '{}' (ID: {}). Performing updating write.", 
                    data.fullName(), politician.getPoliticianId());
        }

        log.debug("Fetching supplemental biography summary from Wikipedia API for '{}'", data.fullName());
        Optional<WikipediaSummary> wikipediaSummary = Optional.empty();
        try {
            wikipediaSummary = wikipediaService.getSummary(data.fullName());
            log.debug("Wikipedia API summary fetch concluded for '{}'. Found status = {}", 
                    data.fullName(), wikipediaSummary.isPresent());
        } catch (Exception e) {
            log.warn("Wikipedia summary retrieval failed for '{}' (proceeding with fallback data): {}", 
                    data.fullName(), e.getMessage());
        }

        politician.setFullName(limit(data.fullName(), 150));
        politician.setPosition(limit(data.position(), 100));
        politician.setJurisdiction(fallback(data.jurisdiction(), "NATIONAL"));
        politician.setPartyAffiliation(limit(data.partyAffiliation(), 100));
        
        String profileImg = firstPresent(data.profileImageUrl(), wikipediaSummary
                .map(WikipediaSummary::thumbnailUrl)
                .orElse(null));
        politician.setProfileImageUrl(profileImg);
        
        if (wikipediaSummary.isPresent()) {
            politician.setBiography(wikipediaSummary.get().biography());
        } else if (politician.getBiography() == null || politician.getBiography().isBlank()) {
            politician.setBiography("No biography is currently available for this public official.");
        }
        
        // Map actual term start and end dates from Wikidata with safe default fallback
        if (data.termStart() != null) {
            politician.setTermStart(data.termStart());
        } else if (politician.getTermStart() == null) {
            politician.setTermStart(LocalDate.of(2022, 6, 30));
        }

        if (data.termEnd() != null) {
            politician.setTermEnd(data.termEnd());
        } else if (politician.getTermEnd() == null) {
            politician.setTermEnd(LocalDate.of(2025, 6, 30));
        }

        politician.setStatus(ACTIVE_STATUS);

        Politician savedPolitician = politicianRepository.save(politician);
        log.info("Successfully committed politician record to persistent ledger: '{}' (Assigned UUID: {})", 
                savedPolitician.getFullName(), savedPolitician.getPoliticianId());
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
