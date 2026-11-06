package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.politikapp.backend.common.HttpResponseException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class CongressImportServiceTests {
    private static final String COMMIT = "a".repeat(40);

    @Test
    void rejectsWritesWithoutTheExactSuccessfulDatabaseAwarePreview() {
        CongressStore store = mock(CongressStore.class);
        when(store.schemaReady()).thenReturn(true);
        try (var fixture = new Fixture(store)) {
            var service = fixture.service;
            UUID id = UUID.randomUUID();
            var request = new CongressImportService.ImportRequest(COMMIT, false, false, 20, id);
            assertThrows(HttpResponseException.class, () -> service.start(request));
            for (var preview : List.of(
                    job(id, "COMPLETED", true, 19, false, COMMIT),
                    job(id, "COMPLETED", true, 20, true, COMMIT),
                    job(id, "COMPLETED", true, 20, false, "b".repeat(40)),
                    job(UUID.randomUUID(), "COMPLETED", true, 20, false, COMMIT),
                    job(id, "COMPLETED_WITH_ISSUES", true, 20, false, COMMIT),
                    job(id, "COMPLETED", false, 20, false, COMMIT))) {
                ReflectionTestUtils.setField(service, "job", preview);
                assertThrows(HttpResponseException.class, () -> service.start(request));
            }
            verify(store, never()).currentRevisions();
        }
    }

    @Test
    void acceptsMatchingApprovalAndKeepsItsScopeInJobStatus() {
        CongressStore store = mock(CongressStore.class);
        when(store.schemaReady()).thenReturn(true);
        try (var fixture = new Fixture(store)) {
            UUID id = UUID.randomUUID();
            ReflectionTestUtils.setField(fixture.service, "job", job(id, "COMPLETED", true, 20, true, COMMIT));
            var result = fixture.service.start(new CongressImportService.ImportRequest(COMMIT, false, true, 20, id));
            assertFalse(result.dryRun());
            assertEquals(20, result.congress());
            assertTrue(result.allowUpdates());
            // The fixture has no checkout, so its worker cannot read or write any source records.
        }
    }

    @Test
    void importSwitchStillBlocksAnApprovedPreview() {
        CongressStore store = mock(CongressStore.class);
        var service = new CongressImportService(store, mock(CongressPreview.class), true, false, "");
        try {
            UUID id = UUID.randomUUID();
            ReflectionTestUtils.setField(service, "job", job(id, "COMPLETED", true, 20, false, COMMIT));
            assertThrows(HttpResponseException.class,
                    () -> service.start(new CongressImportService.ImportRequest(COMMIT, false, false, 20, id)));
            verifyNoInteractions(store);
        } finally { service.close(); }
    }

    private static CongressImportService.Job job(UUID id, String state, boolean compared, Integer congress, boolean updates, String commit) {
        return new CongressImportService.Job(id, state, commit, true, Map.of(), List.of(), Instant.now(), Instant.now(), compared, congress, updates);
    }

    private static class Fixture implements AutoCloseable {
        final CongressImportService service;
        Fixture(CongressStore store) { service = new CongressImportService(store, mock(CongressPreview.class), true, true, ""); }
        public void close() { service.close(); }
    }
}
