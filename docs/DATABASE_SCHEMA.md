# PolitikApp Production Database Schema & Entity Registry

This document defines the persistent relational data layer schemas deployed on the Supabase Cloud-Hosted PostgreSQL instance.

## 🧑‍💻 1. Table: `contributors`
* **Purpose:** Stores user credentials, dynamic reputation track records, and authorization token parameters.
* **Columns:**
  * `contributor_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `full_name`: `VARCHAR(150)` (NOT NULL)
  * `email`: `VARCHAR(150)` (NOT NULL, UNIQUE)
  * `role`: `VARCHAR(50)` (NOT NULL, Default: 'CONTRIBUTOR') -- 'CONTRIBUTOR', 'PEER', 'ADMIN'
  * `account_status`: `VARCHAR(50)` (NOT NULL, Default: 'ACTIVE') -- 'ACTIVE', 'LOCKED', 'SUSPENDED'
  * `trust_score`: `DECIMAL(5,2)` (Default: 100.00)
  * `writing_token_status`: `VARCHAR(50)` (Default: 'ACTIVE') -- 'ACTIVE', 'INVALIDATED', 'EXPIRED'
  * `created_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)
  * `updated_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)

## 🏛️ 2. Table: `politicians`
* **Purpose:** Houses verified public profile headers, governmental positions, and contextual biographies.
* **Columns:**
  * `politician_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `full_name`: `VARCHAR(150)` (NOT NULL)
  * `position`: `VARCHAR(100)` (NOT NULL) -- e.g., 'MAYOR', 'COUNCILOR', 'SENATOR'
  * `jurisdiction`: `VARCHAR(100)` (NOT NULL) -- 'NATIONAL' or 'CEBU_CITY'
  * `party_affiliation`: `VARCHAR(100)`
  * `term_start`: `DATE` (NOT NULL)
  * `term_end`: `DATE` (NOT NULL)
  * `profile_image_url`: `TEXT`
  * `biography`: `TEXT`
  * `status`: `VARCHAR(50)` (Default: 'ACTIVE') -- 'ACTIVE', 'INACTIVE', 'ARCHIVED'
  * `created_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)
  * `updated_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)

## 📥 3. Table: `profile_edit_submissions`
* **Purpose:** Stores raw evidence-based data adjustments submitted by crowdsourced platform contributors.
* **Columns:**
  * `submission_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `politician_id`: `UUID` (Foreign Key -> `politicians.politician_id`, ON DELETE CASCADE)
  * `contributor_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE RESTRICT)
  * `source_url`: `TEXT` (NOT NULL) -- Target URL matching approved Top-Level Domains (.gov.ph/.edu.ph)
  * `category_tag`: `VARCHAR(100)` (NOT NULL) -- 'INFRASTRUCTURE', 'HEALTHCARE', 'EDUCATION', 'ENVIRONMENT', 'FINANCE'
  * `action_identifier`: `VARCHAR(150)` (NOT NULL) -- 'SPONSORED_LEGISLATION', 'BUDGET_ALLOCATION', 'COA_FINDING', 'PROJECT_COMPLETION'
  * `quantitative_metric`: `DECIMAL(10,2)` (NOT NULL) -- Numeric parameters (e.g., monetary values, budget lines)
  * `impact_summary`: `TEXT` (NOT NULL) -- Contextual plain-text descriptive summary string
  * `ai_generated`: `BOOLEAN` (Default: false) -- Tracks if AI tool assisted drafting
  * `status`: `VARCHAR(50)` (Default: 'SUBMITTED') -- 'SUBMITTED', 'REJECTED', 'JURY_REVIEW', 'PUBLISHED'
  * `created_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)
  * `updated_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)

## 🚦 4. Table: `moderation_queue`
* **Purpose:** Tracks row data objects currently waiting in the double-blind community verification lifecycle.
* **Columns:**
  * `queue_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `submission_id`: `UUID` (Foreign Key -> `profile_edit_submissions.submission_id`, ON DELETE CASCADE)
  * `politician_id`: `UUID` (Foreign Key -> `politicians.politician_id`, ON DELETE CASCADE)
  * `queue_status`: `VARCHAR(50)` (Default: 'PENDING') -- 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'PUBLISHED', 'REJECTED'
  * `escalation_flag`: `BOOLEAN` (NOT NULL, Default: false) -- Flags if a tie deadlock or timeout occurred
  * `assigned_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP) -- Used by background daemon to compute 24-hour timeout limits
  * `created_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)
  * `updated_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)

## 🗳️ 5. Table: `jury_votes`
* **Purpose:** Stores individual anonymous verification ballots cast by peer reviewers to calculate real-time community consensus.
* **Columns:**
  * `vote_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `queue_id`: `UUID` (Foreign Key -> `moderation_queue.queue_id`, ON DELETE CASCADE)
  * `peer_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE RESTRICT) -- Identifies the reviewer
  * `vote_type`: `VARCHAR(50)` (NOT NULL) -- 'AGREE', 'DISAGREE', 'FLAG'
  * `vote_weight`: `INTEGER` (NOT NULL, Default: 1) -- Stores the scaled influence multiplier (1 or 5) applied at session runtime
  * `vote_reason`: `TEXT` (NOT NULL) -- Reviewer's justification statement string
  * `created_at`: `TIMESTAMP` (Default: CURRENT_TIMESTAMP)

## 📊 6. Table: `reputation_audit_logs`
* **Purpose:** Stores transactional audit trails tracing all reviewer reputation score increases, decreases, and platform penalties.
* **Columns:**
  * `log_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `peer_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE RESTRICT) -- Reviewer account being audited
  * `queue_id`: `UUID` (Foreign Key -> `moderation_queue.queue_id`, ON DELETE SET NULL) -- Ticket associated with the vote
  * `score_change`: `DECIMAL(5,2)` (NOT NULL) -- Amount added/subtracted (e.g. +5.00 or -5.00)
  * `previous_score`: `DECIMAL(5,2)` (NOT NULL) -- Reviewer trust score before calculations
  * `new_score`: `DECIMAL(5,2)` (NOT NULL) -- Reviewer trust score after calculations
  * `reason`: `TEXT` (NOT NULL) -- Informative narrative justification trace string
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)