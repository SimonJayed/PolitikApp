package com.politikapp.backend.submission;

import com.politikapp.backend.submission.service.CitationUrls;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CitationUrlsTests {
    @Test
    void removesTrackingWhilePreservingFunctionalParametersAndPages() {
        assertEquals("https://senate.gov.ph/record?id=1%202&q=3&q=4#page=12", CitationUrls.removeTracking(
                "https://senate.gov.ph/record?id=1%202&utm_source=chatgpt.com&q=3&%75tm_campaign=a&q=4#page=12"));
        assertEquals("https://coa.gov.ph/report.pdf", CitationUrls.removeTracking("https://coa.gov.ph/report.pdf?fbclid=a"));
    }

    @Test
    void keepsSignedQueriesAndRejectsUnsafeCitationSyntax() {
        String signed = "https://dbm.gov.ph/report?X-Amz-Signature=abc&utm_source=chatgpt.com";
        assertEquals(signed, CitationUrls.removeTracking(signed));
        assertFalse(CitationUrls.isWebUrl("javascript:alert(1)"));
        assertFalse(CitationUrls.isWebUrl("https://coa.gov.ph@another.example/report"));
        assertFalse(CitationUrls.isWebUrl("https://coa.gov.ph/a broken path"));
    }
}
