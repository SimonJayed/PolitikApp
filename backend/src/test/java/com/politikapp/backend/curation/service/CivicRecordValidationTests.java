package com.politikapp.backend.curation.service;

import static org.junit.jupiter.api.Assertions.*;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.curation.dto.AdminCurationDtos.AdminMetricUpsertRequest;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CivicRecordValidationTests {
    private AdminMetricUpsertRequest request(String action, Map<String, Object> details, String url) {
        return new AdminMetricUpsertRequest(UUID.randomUUID(), "Audit", action, details,
                "Test fixture only", url, null);
    }

    @Test
    void validatesAllFourExistingRecordTypes() {
        assertDoesNotThrow(() -> CivicRecordValidation.validate(request("COA_FINDING", Map.of("flaggedAmount", 0), "https://www.coa.gov.ph/")));
        assertDoesNotThrow(() -> CivicRecordValidation.validate(request("BUDGET_ALLOCATION", Map.of("allocationAmount", "125.50"), "https://www.dbm.gov.ph/")));
        assertDoesNotThrow(() -> CivicRecordValidation.validate(request("PROJECT_COMPLETION", Map.of("completionPercentage", 100), "https://www.dpwh.gov.ph/")));
        assertDoesNotThrow(() -> CivicRecordValidation.validate(request("SPONSORED_LEGISLATION", Map.of("legislationTitle", "Test bill", "dateFiled", "2023-02-07", "legislativeStatus", "Enacted"), "https://legacy.senate.gov.ph/")));
    }

    @Test
    void rejectsMissingNegativeNonfiniteAndOutOfRangeMetrics() {
        for (Object amount : new Object[]{-1, "NaN", "Infinity", "not-an-amount"}) {
            assertThrows(HttpResponseException.class, () -> CivicRecordValidation.validate(request("BUDGET_ALLOCATION", Map.of("allocationAmount", amount), "https://www.dbm.gov.ph/")));
        }
        assertThrows(HttpResponseException.class, () -> CivicRecordValidation.validate(request("COA_FINDING", Map.of(), "https://www.coa.gov.ph/")));
        assertThrows(HttpResponseException.class, () -> CivicRecordValidation.validate(request("PROJECT_COMPLETION", Map.of("completionPercentage", 101), "https://www.dpwh.gov.ph/")));
    }

    @Test
    void rejectsForgedProvenanceAndDisguisedCitationHosts() {
        assertThrows(HttpResponseException.class, () -> CivicRecordValidation.validate(request("COA_FINDING", Map.of("flaggedAmount", 1, "sourceReported", true), "https://www.coa.gov.ph/")));
        for (String url : new String[]{"https://example.com/coa.gov.ph", "https://www.coa.gov.ph@evil.test/", "https://www.coa.gov.ph.evil.test/", "javascript:alert(1)"}) {
            assertThrows(HttpResponseException.class, () -> CivicRecordValidation.validate(request("COA_FINDING", Map.of("flaggedAmount", 1), url)));
        }
    }
}
