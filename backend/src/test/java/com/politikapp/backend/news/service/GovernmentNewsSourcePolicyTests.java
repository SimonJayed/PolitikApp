package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import com.politikapp.backend.news.entity.GovernmentSource;
import org.junit.jupiter.api.Test;

class GovernmentNewsSourcePolicyTests {
    @Test
    void removesRequestedPublishersIncludingLegacySenateAndPreservesRemainingSources() {
        for (String url : new String[]{"https://senate.gov.ph/", "https://www.senate.gov.ph/", "https://legacy.senate.gov.ph/",
                "https://www.dost.gov.ph/", "https://www.da.gov.ph/", "https://pia.gov.ph/"}) {
            var source = new GovernmentSource();
            source.setBaseUrl(url);
            assertTrue(GovernmentNewsSourcePolicy.removed(source), url);
        }
        for (String url : new String[]{"https://www.dbm.gov.ph/", "https://www.officialgazette.gov.ph/", "https://pia.gov.ph.example.com/"}) {
            var source = new GovernmentSource();
            source.setBaseUrl(url);
            assertFalse(GovernmentNewsSourcePolicy.removed(source), url);
        }
    }
}
