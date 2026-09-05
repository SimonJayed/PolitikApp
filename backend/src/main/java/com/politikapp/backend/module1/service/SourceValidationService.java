package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Source URL validation service.
 * Performs a domain approval evaluation — only .gov.ph and .edu.ph domains are accepted.
 * The approval result is stored alongside the submission in actionDetails JSONB.
 */
@Service
public class SourceValidationService {
    private static final Pattern WHITELIST_PATTERN = Pattern.compile(
            "^https?://([a-zA-Z0-9-]+\\.)*(gov\\.ph|edu\\.ph)(/.*)?$"
    );

    /**
     * Evaluates whether the source URL originates from an approved domain.
     * Returns true for whitelisted .gov.ph / .edu.ph domains.
     * Throws HttpResponseException if validation fails.
     */
    public boolean validateSourceUrl(String sourceUrl) {
        if (!checkApprovedDomain(sourceUrl)) {
            throw new HttpResponseException(422, "Unprocessable Entity: Target domain fails validation rules.");
        }
        return true;
    }

    /**
     * Checks whether the given URL matches the approved domain whitelist regex.
     */
    public boolean checkApprovedDomain(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        return WHITELIST_PATTERN.matcher(url.trim()).matches();
    }
}
