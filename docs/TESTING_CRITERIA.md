# PolitikApp System Constraints & Testing Criteria

This specification details the hard system thresholds and verification bounds that govern the platform's core mechanics.

## 🛑 1. Source Link Ingestion Whitelist Gates (Module 1)
* **Rule Boundary:** Submissions cannot execute database write transactions unless the incoming `source_url` field string passes the primary domain check pattern.
* **Regex Implementation:** `^https?://([a-zA-Z0-9-]+\.)*(gov\.ph|edu\.ph)(/.*)?$`
* **Expected Fail Response:** Intercept mismatches early at the controller layer and abort, returning an explicit `422 Unprocessable Entity` response payload.

## 🔒 2. The 15% Contributor Error Account Lockout (Module 3)
* **Rule Boundary:** The instant an evaluation loop closes and moves an item's status parameter to a terminal state, the system must parse that contributor's historical file log.
* **Mathematical Assessment:**
  $$\text{Rejection Metric} = \left( \frac{\text{Total Rejected Submissions}}{\text{Total Submissions Filed}} \right) \times 100$$
* **Enforcement Criteria:** If the Rejection Metric is strictly greater than 15.0%, execute `lockContributorAccount()`, flip `is_locked = true` inside the database, and instantly invalidate all active JSON Web Tokens (JWT) to block future platform gateway writes.

## ⚡ 3. The 90% Peer Accuracy Vote Weight Acceleration (Module 3)
* **Rule Boundary:** When an authorized peer reviewer initializes a session, the system computes their consensus accuracy score by evaluating their past ballot records against final platform outcomes.
* **Mathematical Assessment:**
  $$\text{Precision Rating Coefficient} = \left( \frac{\text{Total Consensus-Aligned Votes}}{\text{Total Validation Ballots Cast}} \right) \times 100$$
* **Enforcement Criteria:** If the precision rating coefficient is strictly greater than or equal to 90.0%, scale the active thread's session variable to `vote_weight = 5`. If it falls below 90.0%, maintain the default parameter baseline layout where `vote_weight = 1`.

## ⏰ 4. The 24-Hour Automated Deadlock Scheduler Daemon (Module 2)
* **Rule Boundary:** A scheduled hourly server daemon process must run to inspect records stuck in open processing queues.
* **Trigger Condition A (Temporal Age):** If the difference between the active system server clock and the entry's `created_at` timestamp is $\ge$ 24 hours, automatically trigger an escalation rewrite.
* **Trigger Condition B (Gridlock Tie):** If total votes cast cross baseline minimum limits and the balance results in a perfect 50-50 tie split, execute a tie-breaker event.
* **Enforcement Criteria:** Update the record's flag to `status_flag = 'STATUS_TIMEOUT_ESCALATION'`. This automatically removes the item from the public review lanes and routes it directly to the System Administrator's escalation dashboard interface.

## 🏛️ 5. Wikidata Ingestion Ingestion Boundaries
* **National-Level Constraint:** Only ingest politicians who have held national office (President, Vice President, Senator, Representative) since **May 2022** (office term start time $\ge$ `2022-05-01`).
* **Cebu City Local Constraint:** Only ingest politicians holding local Cebu City offices (Mayor, Vice Mayor, Councilor) who are **currently active** (term end date is absent or in the future).
* **Jurisdiction Mapping Constraint:** Dynamically assign and store `'NATIONAL'` for national offices and `'CEBU_CITY'` for local Cebu City offices in the `jurisdiction` database attribute.