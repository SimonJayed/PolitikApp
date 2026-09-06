# PolitikApp Production Database Schema & Entity Registry

This document defines the persistent relational data layer schemas deployed on the Supabase Cloud-Hosted PostgreSQL instance. It reflects the complete, non-breaking, harmonized schema including modern curation attributes, preserved legacy metrics, and bidirectional synchronization triggers.

---

## 🧑‍💻 1. Table: `contributors`
* **Purpose:** Stores user credentials, dynamic reputation track records, authorization token parameters, and sandbox simulator profiles.
* **Columns:**
  * `contributor_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `full_name`: `VARCHAR(150)` (NOT NULL)
  * `email`: `VARCHAR(150)` (NOT NULL, UNIQUE)
  * `username`: `VARCHAR(80)` (UNIQUE, Case-Insensitive Index)
  * `password_hash`: `VARCHAR(255)` (NOT NULL)
  * `role`: `VARCHAR(50)` (NOT NULL, Default: 'CONTRIBUTOR') -- 'CONTRIBUTOR', 'PEER', 'ADMIN'
  * `account_status`: `VARCHAR(50)` (NOT NULL, Default: 'ACTIVE') -- 'ACTIVE', 'LOCKED', 'SUSPENDED'
  * `trust_score`: `DECIMAL(5,2)` (NOT NULL, Default: 100.00, Range: 0.00 – 500.00)
  * `writing_token_status`: `VARCHAR(50)` (Default: 'ACTIVE') -- 'ACTIVE', 'INVALIDATED', 'EXPIRED'
  * `sandbox_profile_metrics`: `JSONB` (NOT NULL, Default: `'{}'::jsonb`)
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * `updated_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 🏛️ 2. Table: `politicians`
* **Purpose:** Houses verified public profile headers, governmental positions, and contextual biographies.
* **Columns:**
  * `politician_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `full_name`: `VARCHAR(150)` (NOT NULL)
  * `position`: `VARCHAR(100)` (NOT NULL) -- e.g., 'MAYOR', 'COUNCILOR', 'SENATOR', 'PRESIDENT'
  * `jurisdiction`: `VARCHAR(100)` (NOT NULL) -- e.g., 'NATIONAL', 'PASIG_CITY', 'CEBU_CITY'
  * `party_affiliation`: `VARCHAR(100)`
  * `term_start`: `DATE` (NOT NULL)
  * `term_end`: `DATE` (NOT NULL)
  * `profile_image_url`: `TEXT`
  * `biography`: `TEXT`
  * `status`: `VARCHAR(50)` (Default: 'ACTIVE') -- 'ACTIVE', 'INACTIVE', 'ARCHIVED'
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * `updated_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 📥 3. Table: `profile_edit_submissions`
* **Purpose:** Stores crowdsourced data proposals, citizen challenges, and admin direct-curated submissions.
* **Columns:**
  * `submission_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `politician_id`: `UUID` (Foreign Key -> `politicians.politician_id`, ON DELETE CASCADE)
  * `contributor_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE RESTRICT)
  * `source_url`: `TEXT` (NOT NULL) -- Target URL matching approved domains
  * `primary_source_url`: `TEXT` -- Mandatory verified primary citation URL
  * `verification_notes`: `TEXT` -- Curator verification methodology and audit findings
  * `category_tag`: `VARCHAR(100)` (NOT NULL) -- 'INFRASTRUCTURE', 'HEALTHCARE', 'EDUCATION', 'ENVIRONMENT', 'FINANCE', 'LEGISLATION', 'AUDIT'
  * `action_identifier`: `VARCHAR(150)` (NOT NULL) -- 'SPONSORED_LEGISLATION', 'BUDGET_ALLOCATION', 'COA_FINDING', 'PROJECT_COMPLETION', 'CITIZEN_CHALLENGE'
  * `action_details`: `JSONB` (GIN Indexed) -- Dynamic structured payload containing sub-metrics (e.g. `flaggedAmount`, `allocationAmount`, `projectName`)
  * `quantitative_metric`: `DECIMAL(10,2)` (Nullable, preserved legacy attribute, synced via trigger from `action_details`)
  * `impact_summary`: `TEXT` (NOT NULL) -- Plain-text descriptive summary
  * `ai_generated`: `BOOLEAN` (Default: false)
  * `status`: `VARCHAR(50)` (Default: 'SUBMITTED_REQUEST') -- Harmonized superset status constraint
  * `challenge_target_id`: `UUID` -- Referenced timeline entry ID when filing a Citizen Challenge
  * `challenge_reason`: `TEXT` -- Citizen dispute rationale
  * `evidence_url`: `TEXT` -- Citizen evidence citation
  * `admin_resolution_notes`: `TEXT` -- Curator adjudication ruling justification
  * `resolved_at`: `TIMESTAMP` -- Adjudication completion timestamp
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * `updated_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 🚦 4. Table: `moderation_queue`
* **Purpose:** Tracks verification queue items for double-blind peer review and Admin Curator adjudication.
* **Columns:**
  * `queue_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `submission_id`: `UUID` (Foreign Key -> `profile_edit_submissions.submission_id`, ON DELETE CASCADE)
  * `politician_id`: `UUID` (Foreign Key -> `politicians.politician_id`, ON DELETE CASCADE)
  * `appealer_id`: `UUID` -- Contributor ID who filed an appeal
  * `queue_status`: `VARCHAR(50)` (Default: 'SUBMITTED_REQUEST')
  * `escalation_flag`: `BOOLEAN` (NOT NULL, Default: false)
  * `challenge_target_id`: `UUID`
  * `challenge_reason`: `TEXT`
  * `evidence_url`: `TEXT`
  * `admin_resolution_notes`: `TEXT`
  * `resolved_at`: `TIMESTAMP`
  * `assigned_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * `updated_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 📖 5. Table: `timeline_entries`
* **Purpose:** Live, verified civic ledger entries powering the public politician timeline and KPI dashboards.
* **Columns:**
  * `timeline_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `politician_id`: `UUID` (Foreign Key -> `politicians.politician_id`, ON DELETE CASCADE)
  * `submission_id`: `UUID` -- Link to origin submission record
  * `category_tag`: `VARCHAR(100)` (NOT NULL)
  * `action_identifier`: `VARCHAR(150)` (NOT NULL)
  * `action_details`: `JSONB` (GIN Indexed)
  * `quantitative_metric`: `DECIMAL(10,2)` (Nullable, preserved legacy attribute, synced via trigger from `action_details`)
  * `summary`: `TEXT` (NOT NULL)
  * `source_url`: `TEXT`
  * `primary_source_url`: `TEXT`
  * `verification_notes`: `TEXT`
  * `publication_status`: `VARCHAR(50)` (Default: 'PUBLISHED') -- 'DRAFT', 'PUBLISHED', 'RESOLVED_DISMISSED', 'ARCHIVED'
  * `is_hidden`: `BOOLEAN` (NOT NULL, Default: false) -- Soft-deletion flag for disputed/upheld records
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * `updated_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 🗳️ 6. Table: `jury_votes`
* **Purpose:** Stores verification ballots cast by peer reviewers.
* **Columns:**
  * `vote_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `queue_id`: `UUID` (Foreign Key -> `moderation_queue.queue_id`, ON DELETE CASCADE)
  * `peer_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE RESTRICT)
  * `vote_type`: `VARCHAR(50)` (NOT NULL) -- 'AGREE', 'DISAGREE', 'FLAG'
  * `vote_weight`: `INTEGER` (NOT NULL, Default: 1)
  * `vote_reason`: `TEXT` (NOT NULL)
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)
  * **Constraints:** `UNIQUE (queue_id, peer_id)`

---

## 📊 7. Table: `reputation_audit_logs`
* **Purpose:** Audit ledger tracing reviewer trust score increases, deductions, and platform penalties.
* **Columns:**
  * `log_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `peer_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE RESTRICT)
  * `queue_id`: `UUID` (Foreign Key -> `moderation_queue.queue_id`, ON DELETE SET NULL)
  * `score_change`: `DECIMAL(5,2)` (NOT NULL)
  * `previous_score`: `DECIMAL(5,2)` (NOT NULL)
  * `new_score`: `DECIMAL(5,2)` (NOT NULL)
  * `reason`: `TEXT` (NOT NULL)
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 🎓 8. Table: `peer_applications`
* **Purpose:** Stores civic peer reviewer upgrade requests and institutional verification credentials.
* **Columns:**
  * `application_id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `contributor_id`: `UUID` (Foreign Key -> `contributors.contributor_id`, ON DELETE CASCADE)
  * `organization_type`: `VARCHAR(100)` (NOT NULL) -- 'FACULTY', 'RESEARCHER', 'CAMPUS_JOURNALIST', 'CIVIC_VOLUNTEER'
  * `institutional_email`: `VARCHAR(255)` (NOT NULL)
  * `verification_proof_url`: `TEXT` (NOT NULL)
  * `justification_statement`: `TEXT` (NOT NULL)
  * `status`: `VARCHAR(50)` (NOT NULL, Default: 'PENDING') -- 'PENDING', 'APPROVED', 'REJECTED'
  * `created_at`: `TIMESTAMP` (Default: `CURRENT_TIMESTAMP`)

---

## 🔄 Triggers & Compatibility Layer
1. **`set_updated_at`**: Updates `updated_at` timestamp on row modifications.
2. **`safe_json_to_numeric`**: Immutable helper stripping formatting (`$`, `,`) with strict regex checking and exception blocks, preventing numeric casting crashes.
3. **`sync_submission_action_details_metric`**: Bidirectionally synchronizes `action_details` JSONB and legacy `quantitative_metric` columns without runtime errors.