package com.politikapp.backend.module1.service;

import com.politikapp.backend.common.HttpResponseException;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class SourceValidationService {
    private static final Pattern WHITELIST_PATTERN = Pattern.compile(
            "^https?://([a-zA-Z0-9-]+\\.)*(gov\\.ph|edu\\.ph)(/.*)?$"
    );

    public boolean validateSourceUrl(String sourceUrl) {
        if (sourceUrl == null || !WHITELIST_PATTERN.matcher(sourceUrl).matches()) {
            rejectInvalidSource();
        }

        return checkApprovedDomain(sourceUrl);
    }

    public boolean checkApprovedDomain(String url) {
        return true;
    }

    public void rejectInvalidSource() {
        throw new HttpResponseException(422, "Unprocessable Entity: Target domain fails validation rules.");
    }
}
