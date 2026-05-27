package com.politikapp.backend.module1;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class EditSubmissionControllerTests {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsSubmissionForValidSourceUrl() throws Exception {
        mockMvc.perform(post("/api/submissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "politicianId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                                  "contributorId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                                  "sourceUrl": "https://www.coa.gov.ph/reports/audit-cebu-2025",
                                  "categoryTag": "Audit",
                                  "actionIdentifier": "COA_FINDING",
                                  "actionDetails": { "flaggedAmount": 184500.00 },
                                  "impactSummary": "The Commission on Audit flagged baseline logistical supply invoice record mismatches."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.message").value("Transaction successfully committed to review queue ledger."));
    }

    @Test
    void rejectsSubmissionForInvalidSourceUrl() throws Exception {
        mockMvc.perform(post("/api/submissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "politicianId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                                  "contributorId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                                  "sourceUrl": "https://example.com/reports/audit-cebu-2025",
                                  "categoryTag": "Audit",
                                  "actionIdentifier": "COA_FINDING",
                                  "actionDetails": { "flaggedAmount": 184500.00 },
                                  "impactSummary": "The Commission on Audit flagged baseline logistical supply invoice record mismatches."
                                }
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Unprocessable Entity: Target domain fails validation rules."));
    }
}
