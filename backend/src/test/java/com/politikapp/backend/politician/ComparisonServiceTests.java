package com.politikapp.backend.politician;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.repository.TimelineEntryRepository;
import com.politikapp.backend.politician.service.ComparisonService;
import com.politikapp.backend.politician.service.DashboardMetricsService;
import com.politikapp.backend.politician.service.TimelineMapper;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ComparisonServiceTests {
    private final PoliticianRepository politicians = mock(PoliticianRepository.class);
    private final TimelineEntryRepository entries = mock(TimelineEntryRepository.class);
    private final DashboardMetricsService metrics = mock(DashboardMetricsService.class);
    private final ComparisonService service = new ComparisonService(politicians, entries, metrics, mock(TimelineMapper.class));

    private Politician person(String position) {
        var person = new Politician(); person.setPoliticianId(UUID.randomUUID()); person.setPosition(position);
        when(politicians.findById(person.getPoliticianId())).thenReturn(Optional.of(person));
        return person;
    }

    @ParameterizedTest
    @CsvSource({"SENATOR,HOUSE_REPRESENTATIVE", "HOUSE_REPRESENTATIVE,PRESIDENT", "PRESIDENT,VICE_PRESIDENT", "VICE_MAYOR,MAYOR", "'',SENATOR", "'', ''"})
    void rejectsDifferentOrMissingPositionsBeforeReadingComparisonRecords(String a, String b) {
        var left = person(a); var right = person(b);
        var error = assertThrows(HttpResponseException.class, () -> service.executeSideBySideComparison(left.getPoliticianId(), right.getPoliticianId()));
        assertTrue(error.getMessage().contains("same position"));
        verifyNoInteractions(entries, metrics);
    }

    @ParameterizedTest
    @CsvSource({"SENATOR,SENATOR", "SENATE,SENATOR", "HOUSE_REPRESENTATIVE,HOUSE", "CONGRESSWOMAN,REPRESENTATIVE", "PRESIDENT,PRESIDENT", "VICE_PRES,VICE_PRESIDENT", "mayor,MAYOR"})
    void allowsDistinctPeopleWithTheSameNormalizedPosition(String a, String b) {
        var left = person(a); var right = person(b);
        assertDoesNotThrow(() -> service.executeSideBySideComparison(left.getPoliticianId(), right.getPoliticianId()));
        verify(entries).findActiveEntries(left.getPoliticianId(), "PUBLISHED");
        verify(entries).findActiveEntries(right.getPoliticianId(), "PUBLISHED");
    }
}
