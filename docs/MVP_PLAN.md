# PolitikApp MVP Development Plan & Vertical Slice Execution Strategy

**Document Status:** RELEASED / ALIGNED WITH MAY 2026 SDD  
**Target Milestone:** Phase 3 MVP - 80% Enhanced Vertical Slice Connection Strategy  

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
    6. **`reputation_audit_logs` [NEW]:** tracks real-time score additions, subtractions, and penalty calculations for audit trails.
* [ ] **2.2 Index Deployment Optimization**
  * Establish query performance lookups (`idx_pending_edits_politician_status`) across foreign keys to optimize runtime retrieval cycles for dashboards.
  * **Index Expansion [NEW]:** Deploy `idx_reputation_logs_peer_date` to accelerate chronological score aggregation over long-term jury histories.

---

## ⚙️ Phase 3: Backend Controller & Service Layer Engineering
* [ ] **3.1 Module 1: Source-First Profile Aggregator Logic**
  * **Build `EditSubmissionController`:** Expose `POST /api/submissions` to capture incoming crowdsourced adjustments.
  * **Build `SourceValidationService`:** Implement a defensive interceptor gate verifying incoming URLs against approved government domain structures (`.gov.ph` and `.edu.ph`) using strict regular expression whitelist checks. Throw an explicit `422 Unprocessable Entity` response map if validation evaluates to False.
  * **Build `DashboardService` & `KPIComputationService`:** Implement optimized read routines for `GET /api/politicians/{politicianId}/dashboard`. Calculate the Legislative Efficiency Ratio on-the-fly in active server memory loops to bypass database rows calculation bloat.
* [ ] **3.2 Module 2: Asynchronous Judicial Moderation Engine**
  * **Build `ModerationController`:** Expose `GET /api/moderation/pending` to serve the queue deck views.
  * **Implement Privacy Masking Interceptor:** Strip authorship details completely inside the data retrieval service layer before payload transmission to maintain strict double-blind community neutrality (`contributor_id = null`).
  * **Build `VoteService` & `ConsensusService`:** Code `POST /api/moderation/vote` to log peer evaluation ballots. **Integrate Module 3 Engine Link:** Intercept the active reviewer session's dynamic trust score from `ReputationEngineService` to dynamically multiply their vote impact ($T_i \ge 90 \rightarrow \text{weight } 5$, otherwise $1$). If community consensus thresholds are achieved, cascade the updates cleanly onto the core `politicians` table records.
  * **Build `EscalationSchedulerService`:** Create an automated cron job daemon on the server clock running every hour to monitor queue data ages. If a row age is $\ge$ 24 hours or experiences a perfect 50-50 split tie deadlock, automatically write its identifier flag to `STATUS_TIMEOUT_ESCALATION` and route it directly to the private Admin panel.
* [ ] **3.3 Module 3: Reputation-Based Trust Architecture [NEW MODULE ADDITION]**
  * **Build `ReputationEngineService`:** Code the core automated scoring loops. When Module 2 achieves consensus, process a background math evaluation:
    * *Reward Matrix:* Peers whose ballots aligned with the winning historical consensus path receive a $+5.00$ reputation bump.
    * *Penalty Matrix:* Peers whose ballots directly opposed the final consensus are penalized with a $-