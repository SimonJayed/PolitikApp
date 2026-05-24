# PolitikApp MVP Development Plan & Vertical Slice Execution Strategy

**Document Status:** RELEASED / ALIGNED WITH MAY 2026 SDD
**Target Milestone:** Phase 3 MVP - 60% Vertical Slice Connection Strategy

---

## 📅 Phase 1: Project Skeleton & Environment Sync
* [ ] **1.1 Monorepo Environment Setup**
  * Initialize git version control and provision a private GitHub repository.
  * Establish local package configuration scopes for the React frontend application client.
  * Standardize Maven/Gradle dependency trees for the Spring Boot REST server framework.
* [ ] **1.2 Cross-Origin Accessibility Configurations**
  * Inject the `@CrossOrigin(origins = "*")` wildcard security annotation tier directly across all backend controller headers to permit cross-hardware local sleepover Wi-Fi developer execution mapping.
  * Force frontend API clients to point dynamically to the host machine's active IPv4 network route target string (`http://192.168.1.100:8080/`).

---

## 🗄️ Phase 2: Relational Persistence Layer Deployment
* [ ] **2.1 Schema Migration Execution**
  * Provision tables natively inside your cloud-hosted Supabase PostgreSQL instance using the exact structural blueprints from `DATABASE_SCHEMA.md`:
    1. `contributors` (User records, dynamic trust balances, account statuses).
    2. `politicians` (Profile parameters, historical timelines, biographical logs).
    3. `profile_edit_submissions` (Evidentiary data payloads, source whitelist indicators).
    4. `moderation_queue` (Community review tickets, velocity markers, escalation trackers).
    5. `jury_votes` (Double-blind ballot logs, scaled user weights).
* [ ] **2.2 Index Deployment Optimization**
  * Establish query performance lookups (`idx_pending_edits_politician_status`) across foreign keys to optimize runtime retrieval cycles for dashboards.

---

## ⚙️ Phase 3: Backend Controller & Service Layer Engineering
* [ ] **3.1 Module 1: Source-First Aggregator Logic**
  * **Build `EditSubmissionController`:** Expose `POST /api/submissions` to capture incoming crowdsourced adjustments.
  * **Build `SourceValidationService`:** Implement a defensive interceptor gate verifying incoming URLs against approved government domain structures (`.gov.ph` and `.edu.ph`) using strict regular expression whitelist checks. Throw an explicit `422 Unprocessable Entity` response map if validation evaluates to False.
  * **Build `DashboardService` & `KPIComputationService`:** Implement optimized read routines for `GET /api/politicians/{politicianId}/dashboard`. Calculate the Legislative Efficiency Ratio on-the-fly in active server memory loops to bypass database rows calculation bloat.
* [ ] **3.2 Module 2: Asynchronous Judicial Moderation Engine**
  * **Build `ModerationController`:** Expose `GET /api/moderation/pending` to serve the queue deck views.
  * **Implement Privacy Masking Interceptor:** Strip authorship details completely inside the data retrieval service layer before payload transmission to maintain strict double-blind community neutrality (`contributor_id = null`).
  * **Build `VoteService` & `ConsensusService`:** Code `POST /api/moderation/vote` to log peer evaluation ballots. Integrate the active reviewer session's dynamic trust scaling variables (`vote_weight = 1` or `vote_weight = 5`). If community threshold limits are met, cascade aggregate updates cleanly onto the core `politicians` table records.
  * **Build `EscalationSchedulerService`:** Create an automated cron job daemon on the server clock running every hour to monitor queue data ages. If a row age is $\ge$ 24 hours or experiences a perfect 50-50 split tie deadlock, automatically write its identifier flag to `STATUS_TIMEOUT_ESCALATION` and route it directly to the private Admin panel.

---

## 🎨 Phase 4: Frontend View Layout Component Assembly
* [ ] **4.1 Module 1 Dashboard Views**
  * **Assemble `EditSubmissionForm.jsx`:** Map reactive local form states perfectly to match your backend DTO fields. Integrate sub-components `SourceUrlInput.jsx` and `AlSummaryGenerator.jsx`.
  * **Assemble `PoliticianDashboard.jsx`:** Group basic header components with interactive `KPIWidget.jsx` metric frames and chronological `TimelineLedger.jsx` lists.
* [ ] **4.2 Module 2 Moderation Views**
  * **Assemble `ModerationQueueDashboard.jsx`:** Construct an anonymized verification data matrix mapping entry info blocks cleanly accompanied by operational `PeerVotingPanel.jsx` trigger controls ("Agree", "Disagree", "Flag for Revision").

---

## 🧪 Phase 5: Verification & Checkpoint Alignment
* [ ] **5.1 Alignment Validation Audit**
  * Verify that all input parameters match the database schemas.
  * Confirm that all system-automated operations (like the 15% contributor lockout trigger or the hourly deadlock scanner evaluation loops) run safely inside the server context layers.
  * Cross-examine all execution boundaries before demonstrating the final working 60% pipeline to Sir Jensar sayson.