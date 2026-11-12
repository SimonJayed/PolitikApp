package com.politikapp.backend.curation.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.curation.dto.AdminCurationDtos.AdminMetricUpsertRequest;
import java.net.URI;
import java.net.URISyntaxException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Validate new administrative records without rewriting historical records. */
final class CivicRecordValidation {
    private CivicRecordValidation() {}

    static void validate(AdminMetricUpsertRequest request) {
        validateCitation(request.primarySourceUrl());
        Map<String, Object> details = request.actionDetails() == null ? Map.of() : request.actionDetails();
        // Imported provenance is server-managed and cannot be forged through the generic editor.
        if (details.containsKey("openCongressId") || details.containsKey("sourceReported")
                || details.containsKey("sourceKey") || details.containsKey("verifiedByAdminId")) {
            invalid("Congress provenance must be managed through Congress verification.");
        }
        switch (request.actionIdentifier()) {
            case "COA_FINDING" -> amount(details, "flaggedAmount", null);
            case "BUDGET_ALLOCATION" -> amount(details, "allocationAmount", null);
            case "PROJECT_COMPLETION" -> amount(details, "completionPercentage", new BigDecimal("100"));
            case "SPONSORED_LEGISLATION" -> {
                if (!(details.get("legislationTitle") instanceof String title) || title.isBlank()) {
                    invalid("Legislation title is required.");
                }
                if (!List.of("FILED", "IN COMMITTEE", "IN_COMMITTEE", "APPROVED", "ENACTED", "REJECTED", "WITHDRAWN", "UNKNOWN")
                        .contains(String.valueOf(details.get("legislativeStatus")).trim().toUpperCase(java.util.Locale.ROOT))) {
                    invalid("A supported legislative status is required.");
                }
                try { LocalDate.parse(String.valueOf(details.get("dateFiled"))); }
                catch (RuntimeException failure) { invalid("A valid filing date is required."); }
            }
            default -> invalid("Unsupported accountability action.");
        }
    }

    // Admins may cite any website; there is no source-domain allowlist here.
    private static void validateCitation(String sourceUrl) {
        if (sourceUrl != null && !sourceUrl.isBlank()) {
            try {
                URI uri = new URI(sourceUrl.trim());
                if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                        && uri.getHost() != null && uri.getUserInfo() == null) {
                    return;
                }
            } catch (URISyntaxException ignored) { /* Report an invalid web link below. */ }
        }
        invalid("Enter a complete HTTP or HTTPS source URL without credentials.");
    }

    private static void amount(Map<String, Object> details, String key, BigDecimal maximum) {
        try {
            BigDecimal value = new BigDecimal(String.valueOf(details.get(key)));
            if (value.signum() < 0 || (maximum != null && value.compareTo(maximum) > 0)) {
                invalid(key + " is outside its permitted range.");
            }
        } catch (NumberFormatException failure) {
            invalid(key + " must be a nonnegative number.");
        }
    }

    private static void invalid(String message) { throw new HttpResponseException(422, message); }
}
