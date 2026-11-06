# PolitikApp Project Objectives & System Specifications

**Architecture Version:** 2.0 (Centralized Evidence-Based Admin Curation & Citizen Public Disputes)  
**Milestone:** Production Alignment & Public Transparency Framework  

---

## 1. Objectives

### 1.1 General Objectives

- **General Objective 1 (Module 1: Source-First Profile Aggregator):** To optimize data centralization and civic accessibility by integrating fragmented public governance records into unified, searchable candidate dashboards with verified primary-source citations.
- **General Objective 2 (Module 2: Evidence-Based Curation & Citizen Adjudication Engine):** To maintain strict narrative neutrality and eliminate platform vulnerability to organized partisan narrative manipulation or coordinated "edit wars" through professional curator verification and an adversarial citizen challenge system.
- **General Objective 3 (Module 3: Zero-Trust Attribution & Civic Security Architecture):** To maximize data accuracy, enforce strict accountability among platform contributors, and protect civic infrastructure through cryptographic session attribution and memory-safe sliding-window rate limiting.

---

### 1.2 Specific Objectives (SMART)

#### Module 1: Source-First Profile Aggregator Functional Goals

- **Specific Objective 1.1 (Automate Source Validation):** Enforce a strict domain-whitelist filter (`.gov.ph`, `.edu.ph`) to eliminate unverified external entries, ensuring that 100% of user-submitted background data points match primary-source links before reaching the curation queue.
- **Specific Objective 1.2 (Minimize Search Friction):** Consolidate isolated legislative records, COA audit logs, and official performance metrics to reduce user cross-referencing times across different institutional web spaces by at least 40%.
- **Specific Objective 1.3 (Enhance Information Comprehension):** Translate dense legal terminology and long-form audit logs into structured text summaries and World Governance Indicators (WGI), improving governance literacy among student voters during user acceptance testing.
- **Specific Objective 1.4 (Categorized Evaluation & Comparative Analysis):** Integrate dynamic, tiered sorting algorithms and a side-by-side profile comparison matrix to segment national and Cebu City-localized public officials, achieving a 100% data computation accuracy rate when generating relative performance metrics.
- **Specific Objective 1.5 (Public Guest Discovery):** Provide a friction-free guest mode enabling unauthenticated citizens and researchers to browse politician profiles, rankings, and compare tools without mandatory registration.

#### Module 2: Evidence-Based Curation & Citizen Adjudication Engine Functional Goals

- **Specific Objective 2.1 (Admin Curator Ingestion & Verification):** Route incoming civic proposals to an administrative curation ledger where trained curators verify primary sources against official gazettes, COA findings, and legislative records with 100% citation fidelity.
- **Specific Objective 2.2 (Citizen Public Disputes & Counter-Evidence Pipeline):** Implement an adversarial dispute workflow allowing authenticated citizens to formally challenge existing timeline records by supplying counter-evidence URLs and dispute rationale.
- **Specific Objective 2.3 (Transparent Ledger Audit & Soft Deletion):** Maintain an immutable public audit trail for all approved, dismissed, and disputed items, using soft-deletion (`is_hidden`) and public justification notes to eliminate partisan edit wars and preserve historical accountability.

#### Module 3: Zero-Trust Attribution & Civic Security Architecture Functional Goals

- **Specific Objective 3.1 (Cryptographic Identity & Verified Attribution):** Enforce strict JWT-bound session principals for all proposal submissions and citizen challenges, preventing identity spoofing and privilege escalation in user profile states.
- **Specific Objective 3.2 (Abuse Mitigation & Sliding-Window Rate Limiting):** Deploy an automated sliding-window rate-limiting layer on public proposal and authentication endpoints to mitigate brute force, coordinated denial-of-service, and queue-flooding attacks.
- **Specific Objective 3.3 (Data Export & Transparency):** Provide CSV and JSON data export capabilities for verified timeline records and COA audit findings to empower student journalists and civic researchers.

---

## 2. Expected System

### 2.1 Key Features of the System

- **Public Guest Landing Page & Telemetry:** Dynamic animated counters tracking total monitored officials, verified records, analyzed budgets, and active challenges, accompanied by a 3-pillar verification explainer.
- **Public Politician Directory & Profiler:** Searchable roster with filter tags (National vs Cebu City, office positions), biographical details, legislative timelines, and WGI governance indicators.
- **Side-by-Side Politician Comparator:** Empirical comparison matrix evaluating two elected officials across bills authored, enacted laws, allocated budgets, and audit flags.
- **Source-First Metric Proposal Workflow:** Whitelisted domain validation (`.gov.ph` / `.edu.ph`), category taxonomy, and structured metric ingestion for authenticated citizens.
- **Citizen Public Challenge Modal:** Adversarial dispute tool allowing citizens to submit verifiable counter-evidence against disputed records.
- **Admin Adjudication & Curation Dashboard:** High-authority curation table enabling curators to review citations, approve additions to the live ledger, uphold challenges, or dismiss with public reason.

### 2.2 High-Level Workflow of the System

```
[Public Guest / Citizen]
        │
        ├── Browses Directory, Profiles, Compare Matrix (Read-Only)
        │
        └── Authenticates to Participate
                │
                ├── [Propose Metric] ──► Domain Whitelist Check ──► SUBMITTED_REQUEST
                │                                                          │
                └── [Challenge Record] ──► Counter-Evidence Check ─► CHALLENGE_OPEN
                                                                           │
                                                                           ▼
                                                            [Admin Curation Table]
                                                                           │
                                              ┌────────────────────────────┴────────────────────────────┐
                                              ▼                                                         ▼
                                       [Proposal Upheld]                                       [Challenge Upheld]
                                              │                                                         │
                                    Published to Live Ledger                                 Soft-Deleted (is_hidden=true)
                                    & Recalculate WGI Score                                  & Deduct Discrepancy Amount
```

#### 1. Input Stage (Submission & Whitelisting)
- Registered citizens submit proposals regarding bills, budget allocations, or audit findings.
- The system enforces target politician binding, `.gov.ph`/`.edu.ph` URL whitelisting, action identifiers, and impact summaries. Unwhitelisted links are rejected automatically.

#### 2. Process Stage (Curator Adjudication & Adversarial Challenges)
- Submissions enter the `moderation_queue` under `SUBMITTED_REQUEST` or `CHALLENGE_OPEN`.
- Administrators audit the primary-source documents directly. If valid, the proposal is approved; if fraudulent, it is dismissed with recorded justification notes.
- Citizens can file disputes against published timeline records by attaching counter-evidence.

#### 3. Output Stage (Public Ledger & Civic Telemetry)
- Approved entries are aggregated into the politician's live profile ledger and trigger WGI score recalculation.
- Upheld citizen challenges soft-delete the flagged record (`is_hidden = true`) and adjust COA audit metrics accordingly.

---

## 3. Scope & Limitations

### 3.1 Scope of the System
- **Relational Database Core:** Centralized profile structures tracking elected officials through empirical variables: Full Name, Current Office, Region/Constituency, Bills Authored, Bills Passed, Budgets Allocated, and COA Audit Discrepancies.
- **Centralized Curation with Public Recourse:** Eliminates the vulnerability of crowdsourced peer-juries to partisan capture by placing verification in the hands of trained curators, paired with public citizen counter-evidence disputes.
- **Jurisdictional Coverage:** Segregated ranking matrices and profiles for National Scope (Senators, Cabinet Secretaries) and Local Scope (Elected Officials belonging to the active administration term of Cebu City).

### 3.2 Limitations of the Project
- **Temporal and Positional Bounding:** The platform tracks data generated from the May 2022 election cycle up to the present (2026). Local tracking is strictly bound to the active terms within Cebu City.
- **Primary Source Dependencies:** The application operates strictly as a structural aggregator and verification layer. It relies on official government portals (`.gov.ph`) and cannot independently produce records where official public repositories have omitted them.
- **Strict Factual Non-Partisanship:** The platform is explicitly restricted to verified documentary evidence and empirical metrics. It strictly rejects opinion editorials, subjective predictions, and unverified social media claims.

### 3.3 Expected Contribution
- **Elimination of Information Silos:** Centralizes fragmented legislative and audit portals into a single responsive web interface for youth and student voters.
- **Empirical Democratic Accountability:** Replaces emotional and algorithmic social media propaganda with cold, verified primary-source track records.
- **Robust Civic Platform Model:** Demonstrates an evidence-backed curation architecture resistant to brigading, coordinated edit wars, and partisan capture.