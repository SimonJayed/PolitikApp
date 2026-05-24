package com.politikapp.backend.module1;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module1.service.SourceValidationService;
import org.junit.jupiter.api.Test;

class SourceValidationServiceTests {
    private final SourceValidationService sourceValidationService = new SourceValidationService();

    @Test
    void acceptsGovernmentAndEducationPhilippineDomains() {
        assertThat(sourceValidationService.validateSourceUrl("https://www.coa.gov.ph/reports/audit-cebu-2025"))
                .isTrue();
        assertThat(sourceValidationService.validateSourceUrl("http://library.up.edu.ph/archive/item"))
                .isTrue();
    }

    @Test
    void rejectsNonWhitelistedDomains() {
        assertThatThrownBy(() -> sourceValidationService.validateSourceUrl("https://example.com/report"))
                .isInstanceOf(HttpResponseException.class)
                .hasMessage("Unprocessable Entity: Target domain fails validation rules.");
    }
}
