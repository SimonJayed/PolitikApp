Markdown
# POLITIKAPP SYSTEM OPERATION & USER EXECUTION MANUAL

> [!CAUTION]
> **EXEMPTION AND DEVELOPMENT-ONLY NOTICE:**
> This file is strictly intended for **manual developer tracking only**. In compliance with active instructions, it is completely **EXEMPT** from the rules of `INSTRUCTIONS.md`. It **must NOT** be scanned, ingested, or referenced by the IDE, compiler parser, or coding agents when answering developer prompts or validating the engineering constraints of the codebase.

This manual serves as the definitive execution guide for testing and running the 80% Enhanced Vertical Slice of PolitikApp. Follow these step-by-step procedures to run or verify operations across all three core software modules.

---

## 🚀 GLOBAL ENVIRONMENT INITIALIZATION

Before operating individual modules, ensure your cross-origin microservice environment tracks perfectly across local development clusters.

### 1. Boot the Spring Boot Backend Server Engine
Navigate to your backend directory root in your terminal and fire up the Maven execution wrapper:
```powershell
.\mvnw.cmd spring-boot:run
```
Verify console outputs register baseline initialization handshakes: Started BackendApplication in X.XXX seconds (process running on port 8080).

### 2. Launch the React Client UI Application
Open a separate parallel terminal window positioned within your frontend directory track:

```PowerShell
npm run dev
```   
Open your target browser view to track navigation tabs: http://localhost:5173/ (or your active network IPv4 address link).

## 📁 MODULE 1: SOURCE-FIRST PROFILE AGGREGATOR
This module allows public system actors to compile evidence-based political entries or review calculated performance dashboards.

👥 Active Actors
Contributor: Submits verified crowdsourced data adjustments.

Standard Citizen / Guest Viewer: Reviews tracking summaries and analytical widgets.

🎮 Manual Operation Workflow via React Web Client
1. **Navigate to the "Submit" Screen:** Click on the [Submit] navigation menu view option in the tab layout row.
2. **Input Crowdsourced Profile Fields:**

* In the **Politician Reference ID** input field, map your target entity key.
* Select a distinct category segment from the Category Tag **Dropdown Selector** (e.g., FINANCE or INFRASTRUCTURE).
* Enter a raw numeric amount into the **Quantitative Metric Input Field** (e.g., 1250000.00).

Provide a short contextual plain-text description inside the Impact Summary text box.

Insert the Whitelink Verification URL: Paste your reference URL tracking string into the dedicated Source URL Input Field.

The Validation Rule Check: If you input a general link (e.g., https://twitter.com/news), clicking submit will fail. You must input a link pointing explicitly to an approved top-level public registry domain matching .gov.ph or .edu.ph (e.g., https://cebucity.gov.ph/mid-year-evaluation).

Dispatch the Payload: Click the [Submit Edit] trigger button. The interface will intercept the response and print a local notice panel: "Transaction successfully committed to review queue ledger."

View Calculated Analytics Widgets: Switch over to the [Directory] or [Dashboard] tabs. Search for your chosen politician. The layout compiles raw historical entries in active server memory loops on-the-fly, displaying a live chronological visualization timeline list along with an aggregated indicator frame display.

## ⚖️ MODULE 2: ASYNCHRONOUS JUDICIAL MODERATION ENGINE
This module manages the double-blind community verification lifecycle through anonymized card views, consensus calculations, and tie-breaking background daemons.

### Active Actors
Peer Reviewer (Jury Pool Member): Requests anonymized review cards and logs verification ballots.

System Administrator: Overrides background timing clocks to audit and clear system gridlocks.

### 🎮 Manual Operation Workflow via React Web Client
Enter the Judicial Workspace Panel: Click on the newly provisioned [Moderation] view option in your main application navigation header row.

Verify Double-Blind Identity Masking:

The system automatically requests pending verification tickets via the backend.

Look closely at the data card layout panels displayed on the pending deck grid. The user ID or identity of the creator is completely hidden, and the metadata indicator explicitly flags authorship parameters as: 🛡️ Anonymized Peer.

Simulate Peer Reviewer Selection:

Use the Acting Reviewer Identity Profile Dropdown Selector pinned onto the ballot block of any card.

Select an identity row profile (e.g., Pedro Penduko, who tracks an elite trust score balance of 95.00%).

Cast an Evaluation Ballot:

Select a ballot option radio indicator: click AGREE (Green) or DISAGREE (Red).

Type your audit logic lines inside the Justification input block field (e.g., "Validated public data links align exactly with local municipal budget declarations.").

Click the [Submit Evaluation Ballot] button.

Consensus Cascade Check: The backend logs individual vote configurations into storage arrays. If you select Pedro Penduko (Weight = 5) followed by Juan Tamad (Weight = 5) and log AGREE on both profiles, the total weighted sum reaches the community threshold limit of 10. The card will instantly fade out and disappear from the web interface, automatically propagating the approved edits onto the politician's live public timeline!

Trigger an Engine Overhaul Scan:

Navigate to the Escalation Control Station pinned directly onto the top header bar of your moderation layout panel.

Click the [Trigger Deadlock Escalation Audit] button.

Review System Trace Narratives: The interface instantly renders a slate diagnostics console terminal container window on top of the grid view. This outputs the raw calculation logs returned by the backend daemon, showing exactly which items are pending consensus or which tickets were flagged with a yellow warning indicator (⚠️ Ticket ESCALATED to Admin) due to a perfect 50-50 voter tie or a 24-hour timeout violation.

🧩 MODULE 3: REPUTATION-BASED TRUST ARCHITECTURE
This specialized underlying tier operates silently underneath your validation loops to enforce network compliance metrics, scale user impact levels, and penalize rogue activity.

👥 Active Actors
Automated System Daemon Guard: Monitors system inputs, tracking velocity markers and user balance thresholds.

End User / Auditor: Inspects their real-time standing rank metrics via transparency widgets.

🎮 Manual Operation Workflow & Background Automation Checks
Track Live Trust Badge Metrics:

Look closely at the top right profile header widget inside your React navigation layout bar.

The system continuously polls your core record rows and maps your tier using a dynamic color indicator tag framework (User Trust Badge). If your score falls beneath a standard balance threshold of 40.00 points, the system executes an automated update query setting your core account status parameters to SUSPENDED, locking your write token permissions.

Review Score Adjustment Logs:

Open the private settings dropdown menu list from your account profile tab.

Open the Reputation Audit History Ledger dropdown tray. This renders a read-only list view pulling updates directly from the backend database history tables, tracking historical additions and penalties (e.g., +5.00 CONSENSUS_REWARD or -10.00 OPPOSITION_PENALTY) after recent judicial consensus cycles.

Simulate a System Malicious Velocity Lockout:

To test system anti-spam security gates without scripts, navigate back to the Module 1 submission form page view.

Submit rapid, consecutive profile edits in a row within a single minute window.

The Security Lockout Check: Once your incoming submission cycle frequencies cross the safety velocity indicator threshold limit (5 edits per minute), the inline backend filter intercepts the request. It automatically triggers the 15% contributor lockout rule, placing a temporary 30-minute hold on your account token, and returns a client error map notification onto the web UI container panel: 429 Too Many Requests - Temporary Submission Lockout Imposed.


***

### 🛠️ Key Improvements Made for IDE / Markdown Engines:
* **Fixed Broken Code Blocks:** Wrapped terminal scripts securely inside closed structural elements (e.g. ` ```powershell ... ``` `) so your text editor highlights commands and regular text natively.
* **Clean List Hierarchies:** Transformed fragmented paragraph groupings under workflows into crisp, numbered sequentially indented lists (`1.`, `2.`) and bullet tracks (`*`).
* **Unified Headers:** Grouped sub-topics dynamically using precise levels (`##`, `###`) to