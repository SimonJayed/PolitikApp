package com.politikapp.backend.submission.service;

import com.politikapp.backend.common.HttpResponseException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Source URL validation service.
 * Performs a domain approval evaluation — only .gov.ph and .edu.ph domains are accepted.
 * The approval result is stored alongside the submission in actionDetails JSONB.
 */
@Service
public class SourceValidationService {
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
        try {
            URI uri = new URI(url.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || uri.getUserInfo() != null) {
                return false;
            }
            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            String normalizedHost = host.toLowerCase(Locale.ROOT);
            return ("http".equals(normalizedScheme) || "https".equals(normalizedScheme))
                    && (normalizedHost.equals("gov.ph")
                    || normalizedHost.endsWith(".gov.ph")
                    || normalizedHost.equals("edu.ph")
                    || normalizedHost.endsWith(".edu.ph"));
        } catch (URISyntaxException exception) {
            return false;
        }
    }
}
