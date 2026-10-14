package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.politikapp.backend.news.entity.GovernmentSource;
import com.politikapp.backend.news.repository.GovernmentSourceRepository;
import com.politikapp.backend.news.repository.NewsArticleRepository;
import java.net.URI;
import org.junit.jupiter.api.Test;

class GovernmentNewsRetrievalServiceTests {
    @Test
    void approvedDestinationAllowsBaseHostAndSubdomainsOnly() {
        GovernmentSource source = new GovernmentSource();
        source.setBaseUrl("https://www.officialgazette.gov.ph");
        GovernmentNewsRetrievalService service = new GovernmentNewsRetrievalService(
                mock(GovernmentSourceRepository.class),
                mock(NewsArticleRepository.class),
                mock(NewsAiService.class)
        );

        assertDoesNotThrow(() -> service.validateApprovedDestination(source, URI.create("https://officialgazette.gov.ph/feed/")));
        assertDoesNotThrow(() -> service.validateApprovedDestination(source, URI.create("https://www.officialgazette.gov.ph/feed/")));
        assertThrows(IllegalArgumentException.class, () -> service.validateApprovedDestination(source, URI.create("https://evilofficialgazette.gov.ph/feed/")));
        assertThrows(IllegalArgumentException.class, () -> service.validateApprovedDestination(source, URI.create("https://example.com/feed/")));
    }
}
