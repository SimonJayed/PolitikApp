package com.politikapp.backend.module1.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class WikipediaService {
    private static final String WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";
    private static final String USER_AGENT = "PolitikApp/1.0 (student project)";

    private final RestClient restClient;

    public WikipediaService(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public Optional<WikipediaSummary> getSummary(String politicianName) {
        if (politicianName == null || politicianName.isBlank()) {
            return Optional.empty();
        }

        String encodedName = URLEncoder.encode(politicianName, StandardCharsets.UTF_8).replace("+", "%20");

        try {
            JsonNode response = restClient.get()
                    .uri(WIKIPEDIA_SUMMARY_URL + encodedName)
                    .header(HttpHeaders.USER_AGENT, USER_AGENT)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                return Optional.empty();
            }

            String biography = textValue(response.path("extract"));
            String thumbnailUrl = textValue(response.path("thumbnail").path("source"));
            return Optional.of(new WikipediaSummary(biography, thumbnailUrl));
        } catch (RestClientException exception) {
            return Optional.empty();
        }
    }

    private String textValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return node.asText();
    }
}
