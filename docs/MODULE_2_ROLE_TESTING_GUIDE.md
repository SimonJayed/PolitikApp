# 🛡️ MODULE 2 ROLE TESTING & SEEDING GUIDE

> [!CAUTION]
> **EXEMPTION AND DEVELOPMENT-ONLY NOTICE:**
> This file is strictly intended for **manual developer verification only**. In compliance with active instructions, it is completely **EXEMPT** from the rules of `INSTRUCTIONS.md`. It **must NOT** be scanned, ingested, or referenced by the IDE, compiler parser, or coding agents when answering developer prompts or validating the engineering constraints of the codebase.

This document serves as your end-to-end, role-based manual sandbox testing manual for **Module 2 (Asynchronous Judicial Moderation Engine)**. By simulating API requests from different user actors, you will trace a crowdsourced edit submission from its initial ingestion, through anonymized peer review card masking, to community consensus calculations, and automated escalation.

---

## 🗄️ Phase A: Database Seeding Setup (Supabase SQL Editor)
To test this workflow, copy and paste the following SQL commands directly into your **Supabase Dashboard SQL Editor** and click **Run**. This registers a test politician and distinct contributor roles (Contributor, Standard Reviewer, Accelerated Reviewer, and Admin).

```sql
-- 1. Clean up any existing test records to avoid unique constraint issues
DELETE FROM public.timeline_entries;
DELETE FROM public.jury_votes;
DELETE FROM public.moderation_queue;
DELETE FROM public.profile_edit_submissions;
DELETE FROM public.politicians WHERE full_name = 'Juan Dela Cruz';
DELETE FROM public.contributors WHERE email IN ('maria.santos@politics.edu.ph', 'pedro.reviewer@jury.edu.ph', 'jose.reviewer@jury.edu.ph', 'andres.admin@politics.gov.ph', 'juan.reviewer@jury.edu.ph');

-- 2. Insert Test Politician (Juan Dela Cruz)
INSERT INTO public.politicians (politician_id, full_name, position, jurisdiction, party_affiliation, term_start, term_end, biography, status)
VALUES ('d1a8c903-8d0f-4882-9e8c-5542b821a4f0', 'Juan Dela Cruz', 'MAYOR', 'CEBU_CITY', 'Independent', '2025-06-30', '2028-06-30', 'Serving Cebu City public officials and citizens.', 'ACTIVE');

-- 3. Insert Contributor (Maria Santos - role = CONTRIBUTOR)
INSERT INTO public.contributors (contributor_id, full_name, email, role, account_status, trust_score)
VALUES ('f90bc892-db21-4322-92ab-7fef4812a321', 'Maria Santos', 'maria.santos@politics.edu.ph', 'CONTRIBUTOR', 'ACTIVE', 100.00);

-- 4. Insert Standard Reviewer (Jose Rizal - role = PEER, trust_score = 80.00 -> standard vote_weight = 1)
INSERT INTO public.contributors (contributor_id, full_name, email, role, account_status, trust_score)
VALUES ('77bc8912-32ba-4abc-992a-ef92481aa322', 'Jose Rizal', 'jose.reviewer@jury.edu.ph', 'PEER', 'ACTIVE', 80.00);

-- 5. Insert Accelerated Reviewer 1 (Pedro Penduko - role = PEER, trust_score = 95.00 -> accelerated vote_weight = 5)
INSERT INTO public.contributors (contributor_id, full_name, email, role, account_status, trust_score)
VALUES ('88bc8912-43ba-4abc-882a-ef92481aa323', 'Pedro Penduko', 'pedro.reviewer@jury.edu.ph', 'PEER', 'ACTIVE', 95.00);

-- 6. Insert Accelerated Reviewer 2 (Juan Tamad - role = PEER, trust_score = 98.00 -> accelerated vote_weight = 5)
INSERT INTO public.contributors (contributor_id, full_name, email, role, account_status, trust_score)
VALUES ('99bc8912-53ba-4abc-772a-ef92481aa324', 'Juan Tamad', 'juan.reviewer@jury.edu.ph', 'PEER', 'ACTIVE', 98.00);

-- 7. Insert System Administrator (Andres Bonifacio - role = ADMIN)
INSERT INTO public.contributors (contributor_id, full_name, email, role, account_status, trust_score)
VALUES ('11bc8912-11ba-4abc-112a-ef92481aa111', 'Andres Bonifacio', 'andres.admin@politics.gov.ph', 'ADMIN', 'ACTIVE', 100.00);
```

---

## 🏃‍♂️ Phase B: Role-Based Execution Sequence

Open a PowerShell terminal window to perform the following sequential tests:

### Step 1: Acting as Maria the Contributor (Submit Factual Evidence)
Maria submits a new infrastructure edit record for Mayor Juan Dela Cruz.

**Standard Windows PowerShell Escaped Call:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/submissions" -ContentType "application/json" -Body "{\`"politicianId\`":\`"d1a8c903-8d0f-4882-9e8c-5542b821a4f0\`",\`"contributorId\`":\`"f90bc892-db21-4322-92ab-7fef4812a321\`",\`"sourceUrl\`":\`"https://www.cebucity.gov.ph/news/mid-year-evaluation\`",\`"categoryTag\`":\`"Finance\`",\`"actionIdentifier\`":\`"BUDGET_ALLOCATION\`",\`"quantitativeMetric\`":1250000.00,\`"impactSummary\`":\`"Successfully enqueued development budget lines.\`"}"
```
* **System Reaction:**
  1. The API saves the edit submission with status `SUBMITTED`.
  2. Spring Events triggers `ModerationQueueListener` on the `AFTER_COMMIT` thread phase.
  3. `ModerationQueueService` adds the card to `moderation_queue` with status `JURY_REVIEW`.

---

### Step 2: Acting as Peer Reviewers (Double-Blind Verification & Consensus Calculations)

#### A. Read Anonymized Queue
First, the reviewer requests the verification deck. Open your browser and navigate to:
👉 **`http://localhost:8080/api/moderation/pending`**

* **Reviewer Assertion:**
  You will see the pending card in the list. **The `"contributorId"` field is completely `null`**, proving the double-blind isolation rule!
* **Get the Queue ID:** Copy the `"queueId"` value from the browser JSON array.

---

#### B. Reviewer 1 (Pedro Penduko - Trust Score 95.00 -> Vote Weight = 5) Votes AGREE
*(Replace the values of `queueId` with your copied queue ID UUID)*
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/moderation/vote" -ContentType "application/json" -Body "{\`"queueId\`":\`"YOUR_QUEUE_ID_HERE\`",\`"peerId\`":\`"88bc8912-43ba-4abc-882a-ef92481aa323\`",\`"voteSelection\`":\`"AGREE\`",\`"voteReason\`":\`"Verified public source links match. Approved.\`"}"
```
* **Consensus Check:** Weighted agree sum = **5**. Consensus is **not met** (requires $\ge$ 10). The card remains in `JURY_REVIEW`.

---

#### C. Reviewer 2 (Jose Rizal - Trust Score 80.00 -> Vote Weight = 1) Votes AGREE
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/moderation/vote" -ContentType "application/json" -Body "{\`"queueId\`":\`"YOUR_QUEUE_ID_HERE\`",\`"peerId\`":\`"77bc8912-32ba-4abc-992a-ef92481aa322\`",\`"voteSelection\`":\`"AGREE\`",\`"voteReason\`":\`"Legitimate budget allocation audit. Approved.\`"}"
```
* **Consensus Check:** Total weighted agree sum = `5 + 1 = 6`. Consensus is **not met**. Card remains in `JURY_REVIEW`.

---

#### D. Reviewer 3 (Juan Tamad - Trust Score 98.00 -> Vote Weight = 5) Votes AGREE
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/moderation/vote" -ContentType "application/json" -Body "{\`"queueId\`":\`"YOUR_QUEUE_ID_HERE\`",\`"peerId\`":\`"99bc8912-53ba-4abc-772a-ef92481aa324\`",\`"voteSelection\`":\`"AGREE\`",\`"voteReason\`":\`"Matches structural reports cleanly.\`"}"
```
* **Consensus Check:** Total weighted agree sum = `6 + 5 = 11`.
* **System Cascade!**
  1. Because weighted `AGREE` reaches `11` ($\ge 10$ and at least double `DISAGREE`), the consensus engine is triggered.
  2. The ticket in `moderation_queue` is updated to `PUBLISHED`.
  3. The `profile_edit_submissions` record is updated to `PUBLISHED`.
  4. **The edits automatically cascade onto the politician's active ledger!** A new record is inserted into the `timeline_entries` table.

---

### Step 3: Acting as Andres the Admin (Auditing Escalation Deadlocks)
If reviewers are gridlocked (e.g. perfect 50-50 splits) or active items exceed 24 hours without consensus, the scheduler daemon escalates the ticket.

We can manually test the hourly escalation scanner loop immediately using our custom endpoint:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/moderation/escalate/trigger"
```

* **Expected Output:**
  ```json
  {
    "message": "Deadlock escalation audit completed successfully.",
    "escalatedCount": 0
  }
  ```
* **Tie Deadlock Verification:**
  If you submit a new ticket and have Reviewer 1 (Pedro - weight 5) vote `AGREE` and Reviewer 3 (Juan - weight 5) vote `DISAGREE`, they form a perfect tie deadlock (`5` vs `5`). Running the trigger command will immediately update that ticket's status to **`ESCALATED`** and set **`escalation_flag = true`**, routing it to the private Admin panel.
