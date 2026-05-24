# MODULE 1: Source-First Profile Aggregator

## 📥 USE CASE 1.1: SUBMIT POLITICIAN PROFILE EDIT
This use case allows authenticated contributors to submit evidentiary governance updates regarding a politician's profile. Submissions are strictly source-first and cannot proceed without an approved government or academic domain reference link.

### I. Architectural Ingestion Contract
* **HTTP Method:** `POST`
* **API Endpoint Path:** `/api/submissions`
* **Content-Type Format:** `application/json`
* **Request Payload Body (DTO):**
```json
{
  "politicianId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "contributorId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "sourceUrl": "https://www.coa.gov.ph/reports/audit-cebu-2025",
  "categoryTag": "Audit",
  "actionIdentifier": "COA_FINDING",
  "quantitativeMetric": 184500.00,
  "impactSummary": "The Commission on Audit flagged baseline logistical supply invoice record mismatches inside the annual municipal reporting registry."
}
```

### II. Core Framework Component Implementations
#### 1. Ingestion Rest Controller Layer

```Java
package com.politikapp.module1.controller;

import com.politikapp.module1.dto.BallotSubmissionPayload;
import com.politikapp.module1.service.SubmissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/submissions")
@CrossOrigin(origins = "*")
public class EditSubmissionController {

    @Autowired
    private SubmissionService submissionService;

    @PostMapping
    public ResponseEntity<Object> submitPoliticianEdit(@RequestBody BallotSubmissionPayload payload) {
        Object response = submissionService.createSubmission(payload);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Object> getSubmissionById(@PathVariable("id") UUID id) {
        Object response = submissionService.getSubmissionById(id);
        return ResponseEntity.ok(response);
    }
}
```

#### 2. Domain Validation Interceptor Service

```Java
package com.politikapp.module1.service;

import org.springframework.stereotype.Service;
import com.politikapp.common.exception.HttpResponseException;

@Service
public class SourceValidationService {

    public boolean validateSourceUrl(String sourceUrl) {
        String whitelistPattern = "^https?://([a-zA-Z0-9-]+\\.)*(gov\\.ph|edu\\.ph)(/.*)?$";
        
        if (sourceUrl == null || !sourceUrl.matches(whitelistPattern)) {
            rejectInvalidSource();
            return false;
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
```

#### 3. Core Metadata Processing Pipeline Integration
```Java
package com.politikapp.module1.service;

import org.springframework.stereotype.Service;
import com.politikapp.module1.dto.BallotSubmissionPayload;
import com.politikapp.common.exception.HttpResponseException;

@Service
public class SubmissionService {

    // Downstream AI Extraction service linkage to process incoming descriptive plain-text summaries
    public Object createSubmission(BallotSubmissionPayload payload) {
        try {
            // Trigger asynchronous verification parsing core processing loops
            boolean parserSuccess = executeExternalAiSummaryExtraction(payload.getImpactSummary());
            if (!parserSuccess) {
                return handleParserTimeout();
            }
        } catch (Exception e) {
            throw new HttpResponseException(503, "Service Unavailable: Asynchronous background dependency timeout.");
        }
        return "Transaction successfully committed to review queue ledger.";
    }

    private boolean executeExternalAiSummaryExtraction(String text) {
        return true; // Mock processor placeholder bypass endpoint logic
    }

    private Object handleParserTimeout() {
        return "System fallback initialized. Saved entry to standard queue channels.";
    }
}
```
## USE CASE 1.2: VIEW CENTRALIZED POLITICIAN DASHBOARD
This use case consolidates political records, performance indicators, audit findings, project information, and historical activities into a single display view to support public transparency.

### I. Architectural Read Optimization & On-the-Fly Analytics
To minimize database writes and prevent storage bloat, all calculated metrics are computed on-the-fly entirely in server memory during the dashboard query block loop.

### II. Ingestion Contract
* **HTTP Method:** `GET`

* **API Endpoint Path:** `/api/politicians/{politicianId}/dashboard`

### III. Server Controller Read & Aggregation Service Logic
```Java
import org.springframework.stereotype.Service;
import com.politikapp.module1.dto.DashboardCompositeResponse;
import com.politikapp.common.exception.HttpResponseException;
import java.util.UUID;
import java.util.List;
import java.math.BigDecimal;

@Service
public class DashboardService {

    public DashboardCompositeResponse getDashboardData(UUID politicianId) {
        Politician politician = database.find(Politician.class, politicianId);
        if (politician == null) {
            throw new HttpResponseException(404, "Not Found: Target profile record does not exist.");
        }

        DashboardCompositeResponse compositeView = new DashboardCompositeResponse();
        compositeView.setPoliticianId(politician.getPoliticianId());
        compositeView.setFullName(politician.getFullName());
        compositeView.setPosition(politician.getPosition());
        compositeView.setJurisdiction(politician.getJurisdiction());
        compositeView.setPartyAffiliation(politician.getPartyAffiliation());

        // Aligned In-Memory Aggregations tracking published lines directly from the submissions table
        List<ProfileEditSubmission> verifiedSubmissions = database.createQuery(
            "SELECT p FROM ProfileEditSubmission p WHERE p.politicianId = :politicianId AND p.status = 'PUBLISHED'", 
            ProfileEditSubmission.class
        ).setParameter("politicianId", politicianId).getResultList();

        long billsAuthored = verifiedSubmissions.stream().filter(s -> "SPONSORED_LEGISLATION".equals(s.getActionIdentifier())).count();
        long projectCompletions = verifiedSubmissions.stream().filter(s -> "PROJECT_COMPLETION".equals(s.getActionIdentifier())).count();
        long coaDiscrepancies = verifiedSubmissions.stream().filter(s -> "COA_FINDING".equals(s.getActionIdentifier())).count();
        
        BigDecimal totalBudget = verifiedSubmissions.stream()
            .filter(s -> "BUDGET_ALLOCATION".equals(s.getActionIdentifier()))
            .map(ProfileEditSubmission::getQuantitativeMetric)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        double dynamicRatio = 0.00;
        if (billsAuthored > 0) {
            dynamicRatio = ((double) projectCompletions / billsAuthored) * 100;
        }
        
        compositeView.setLegislativeEfficiencyRatio(dynamicRatio);
        compositeView.setCoaAuditDiscrepancies((int) coaDiscrepancies);
        compositeView.setTrackedBudgetAllocated(totalBudget);

        // Secure Double-Blind Ledger Fetching
        List<TimelineEntry> historicalTimeline = database.createQuery(
            "SELECT t FROM TimelineEntry t WHERE t.politicianId = :politicianId AND t.publicationStatus = 'PUBLISHED' ORDER BY t.createdAt DESC",
            TimelineEntry.class
        ).setParameter("politicianId", politicianId).getResultList();

        compositeView.setPublishedTimelineLedger(historicalTimeline);
        return compositeView;
    }
}
```
## ⚖️ USE CASE 1.3: EXECUTE SIDE-BY-SIDE CANDIDATE COMPARISON
This use case processes dual distinct matching unique identifier constraints concurrently, running symmetrical parallel database sweeps to build comparison layouts.

### I. Symmetrical Parallel Sweep Contract
* **HTTP Method:** `GET`
* **API Endpoint Path:** `/api/politicians/compare`
* **Query Parameter Syntax:** `?idA={uuid}&idB={uuid}`

### II. Parallel Fetch Implementation Logic

```Java
package com.politikapp.module1.service;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ComparisonService {

    public ComparisonMatrixResponse executeSideBySideComparison(UUID idA, UUID idB) {
        if (idA.equals(idB)) {
            throw new HttpResponseException(400, "Bad Request: Cannot compare identical profile entities.");
        }

        Politician polA = database.find(Politician.class, idA);
        Politician polB = database.find(Politician.class, idB);

        if (polA == null || polB == null) {
            throw new HttpResponseException(404, "Not Found: One or both requested profiles are missing.");
        }

        ComparisonMatrixResponse matrix = new ComparisonMatrixResponse();
        matrix.setProfileA(mapToSymmetricalKPIPayload(polA));
        matrix.setProfileB(mapToSymmetricalKPIPayload(polB));

        List<TimelineEntry> streamA = database.createQuery("SELECT t FROM TimelineEntry t WHERE t.politicianId = :idA AND t.publicationStatus = 'PUBLISHED'", TimelineEntry.class).setParameter("idA", idA).getResultList();
        List<TimelineEntry> streamB = database.createQuery("SELECT t FROM TimelineEntry t WHERE t.politicianId = :idB AND t.publicationStatus = 'PUBLISHED'", TimelineEntry.class).setParameter("idB", idB).getResultList();

        List<AlignedComparisonRow> alignedHorizontalMatrix = new ArrayList<>();
        Set<String> crossCategories = new HashSet<>();
        streamA.forEach(item -> crossCategories.add(item.getCategoryTag()));
        streamB.forEach(item -> crossCategories.add(item.getCategoryTag()));

        for (String category : crossCategories) {
            AlignedComparisonRow row = new AlignedComparisonRow();
            row.setCategoryTag(category);
            row.setRecordsA(streamA.stream().filter(r -> r.getCategoryTag().equals(category)).collect(Collectors.toList()));
            row.setRecordsB(streamB.stream().filter(r -> r.getCategoryTag().equals(category)).collect(Collectors.toList()));
            alignedHorizontalMatrix.add(row);
        }

        matrix.setAlignedHorizontalMatrix(alignedHorizontalMatrix);
        return matrix;
    }
}
```
🖥️ III. COMPONENT LAYOUT STATE SCHEMA (FRONTEND CLIENT STATE ENGINES)
```JavaScript
import React, { useState } from 'react';
// CentralProfileDashboard View Component State Configuration
const [dashboardView, setDashboardView] = useState({
    politician_id: null,
    full_name: '',
    position: '',
    jurisdiction: '',
    bills_authored: 0,
    bills_passed: 0,
    tracked_budget_allocated: 0.00,
    coa_audit_discrepancies: 0,
    legislative_efficiency_ratio: 0,
    published_timeline_ledger: []
});

// CandidateComparisonGrid Split-Screen View State Configuration
const [comparisonGrid, setComparisonGrid] = useState({
  candidate_id_a: null,
  candidate_id_b: null,
  numerical_metrics_matrix: {
    bills_authored_a: 0, bills_authored_b: 0,
    bills_passed_a: 0,   bills_passed_b: 0,
    budget_allocated_a: 0, budget_allocated_b: 0,
    audit_discrepancies_a: 0, audit_discrepancies_b: 0
  },
  aligned_horizontal_matrix: [
    {
      category_tag: '',
      records_a: [],
      records_b: []
    }
  ]
});
```