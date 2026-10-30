package com.politikapp.backend.news.service;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class PoliticalNewsRelevanceTests {
    private final PoliticalNewsRelevance filter = new PoliticalNewsRelevance();

    @Test
    void includesRecentDbmBudgetAndAccountabilityHeadlines() {
        assertTrue(filter.relevant("PS, DBM Push Procurement Reforms to Boost Investor Confidence, Economic Growth Across ASEAN"));
        assertTrue(filter.relevant("DBM to Comply with SC Directives on 2026 UA; Unaffected Budget Provisions Remain Implementable"));
        assertTrue(filter.relevant("Sec. Kim: National Budget Undergoes Rigorous Scrutiny, Checks and Balances Before Becoming Law"));
        assertTrue(filter.relevant("DBM, Senate Push for Stronger Safeguards in P58.53-B LGU Support Fund"));
        assertTrue(filter.relevant("P1.62-B Proposed for National Greening Program in 2027, Nearly Triple 2026 Funding"));
        assertTrue(filter.relevant("Executive Order No. 129, s. 2026"));
    }

    @Test
    void excludesAgencyActivitiesAndUnverifiableGenericProclamations() {
        assertFalse(filter.relevant("PBBM: E-trikes to cut fuel costs, boost drivers’ take-home pay"));
        assertFalse(filter.relevant("Cagayan farmers report higher rice harvests from solar-powered irrigation project"));
        assertFalse(filter.relevant("Proclamation No. 1497 s. 2026"));
        assertFalse(filter.relevant("PBBM declares October 30 a special non-working day in Panabo City"));
        assertFalse(filter.relevant(null));
    }
}
