## Objectives

### General Objectives

- **General Objective 1 (Module 1: Source-First Profile Aggregator):** To optimize data centralization and civic accessibility by integrating fragmented public governance records into unified, searchable candidate dashboards.
- **General Objective 2 (Module 2: Asynchronous Judicial Moderation Engine):** To maintain strict narrative neutrality and minimize platform vulnerability to organized partisan narrative manipulation or coordinated "edit wars".
- **General Objective 3 (Module 3: Reputation-Based Trust Architecture):** To maximize data accuracy and enforce strict accountability among platform contributors through automated, history-driven permission gating.

### Specific Objectives (SMART)

**Module 1: Source-First Profile Aggregator Functional Goals**

- **Specific Objective 1.1 (Automate Source Validation):** Enforce a strict domain-whitelist filter (.gov.ph, .edu.ph) to eliminate unverified external entries, ensuring that 100% of user-submitted background data points match primary-source links.
- **Specific Objective 1.2 (Minimize Search Friction):** Consolidate isolated legislative and audit logs to reduce user cross-referencing times across different institutional web spaces by at least 40%.
- **Specific Objective 1.3 (Enhance Information Comprehension):** Translate dense legal terminology and long-form audit logs into structured text summaries, improving information evaluation accuracy among low-literacy student voters to 85% during user acceptance testing.
- **Specific Objective 1.4 (Categorized Evaluation & Comparative Analysis):** Integrate dynamic, tiered sorting algorithms and a side-by-side profile comparison matrix to segment national and Cebu City-localized public officials, achieving a 100% data computation accuracy rate during functionality testing when generating relative performance metrics.

**Module 2: Asynchronous Judicial Moderation Engine Functional Goals**

- Specific Objective 2.1 (Distribute Verification Workloads): Route new content adjustments to an asynchronous community queue, maintaining a target peer voting velocity where entries are validated or flagged within 24 hours of input without manual admin interaction.
- Specific Objective 2.2 (Ensure Adjudication Reliability): Automate the multi-tier escalation pipeline to isolate disputed or heavily tied entries, routing complex conflicts directly to admin tie-breaker review to maintain platform content neutrality at a verified 100% accuracy level.
- Specific Objective 2.3 (Disrupt Participant Bias): Integrate visual, multi-stage progress bars and tracking elements to communicate the real-time status of content updates, aiming to reduce intuitive, emotion-based sharing loops among platform contributors by at least 30% during testing.

**Module 3: Reputation-Based Trust Architecture Functional Goals**

- Specific Objective 3.1 (Mitigate Coordinated Tampering): Apply mathematical reputation adjustments to user profiles following finalized edit reviews, automatically locking out low-trust users whose submission rejection metrics exceed 15%.
- Specific Objective 3.2 (Reward Verification Consistency): Scale individual contribution permissions automatically, enabling contributors who maintain a sustained historical data precision score of 90% to hold heavier voting weight within the Asynchronous Jury Queue, accelerating the verification of their edits without bypassing mandatory community or administrative oversight.

## Expected System

**4.1 Key Features of the System**

- **User Trust and Reputation System:** Tracks user submissions and automatically promotes or penalizes accounts based on data precision.
- **Transparent Edit Lifecycle System**: A frontend visual progress bar informing users of data verification stages.
- **Tiered Performance Leaderboards:** Segregated ranking matrices comparing politicians based on categorical criteria within local (Cebu) and national jurisdictions.
- **Side-by-Side Politician Profile Comparator:** Interface allowing comparative evaluation of empirical candidate personas.

**4.2 High-Level Workflow of the System**

The high-level workflow of the platform features a unified, crowdsourced routing logic designed to distribute the resource-intensive work of data verification across the community. By utilizing a Decentralized Asynchronous Jury Model, the system leverages collective intelligence for baseline content moderation, reserving direct administrative action strictly for deadlocks, ties, or severe policy violations.

#### 1\. Input Stage (Contribution Submission)

- **User Trigger:** A registered contributor initiates an edit or profile update regarding a politician's legislative voting history, public project allocations, or campaign declarations.
- **Input Parameters:** The interface strictly forces the input of the following structural attributes:
  - **Politician Target ID:** Binding the entry to a specific individual database persona.
  - **Primary Source URL:** A link that must match whitelisted .gov.ph or .edu.ph domains.
  - **Core Category Tag:** e.g., Education, Infrastructure, Healthcare, Environmental Protection, Finance.
  - **Action Type Identifier:** e.g., Sponsored Legislation, Co-Authored Bill, Project Budget Allocation, COA Audit Finding.
  - **Quantitative Metric:** e.g., Bill Number, Pesos Allocated, or Audit Discrepancy Amount.
  - **Impact Text Summary:** A concise text summary written by the contributor outlining the document.
- **Optional AI Input Assistant:** Contributors may click an optional "AI Generate Draft" button. An LLM parses the whitelisted URL and pre-fills the text summary fields. This remains purely as an editable draft that the contributor must manually review, edit, and officially submit themselves.
- **System Guardrail:** Submissions lacking references or originating from unauthorized domains are automatically blocked by the validation engine.

#### 2\. Process Stage (Asynchronous Crowdsourced Moderation)

- **Asynchronous Jury Queue:** Upon passing the initial validation layer, submissions enter a "Pending" status within the moderation engine. Verified community users independently and asynchronously cast "Agree" or "Disagree" votes over time to audit the entry for Language Neutrality and Factual Alignment with the link.
- **Optional Revision Loop:** If the source link is accurate but the written summary is flagged as grammatically broken or highly biased, jury members can click "Flag for Revision", routing the card to a rewrite pipeline instead of a terminal rejection.
- **Clear Consensus:** If an entry crosses a mathematically defined threshold majority of "Agree" votes from the community, the backend engine triggers an automated publication loop.
- **Escalation (Judicial Review):** Deadlocks (such as a 50-50 tie) or 24-hour idle timeouts are automatically elevated to the Admin Review Queue where administrators step in as human-in-the-loop tie-breakers.

#### 3\. Output Stage (Public Ledger Aggregation)

- **Profile Publication:** Approved edits are dynamically aggregated into respective public politician profiles, updating their empirical attributes.
- **Data Simplification & Progress Lifecycle:** The interface updates the 5-stage progress tracking bar (Submitted -> Jury Review -> Adjudication -> Finalized -> Published). Concurrently, the system applies an automated mathematical adjustment to the user's dynamic Reputation-Based Trust Score based on the outcome accuracy.

## PART 5: Discussion

### 5.1 Scope of the System

The proposed system will establish a localized, responsive web-based political tracking registry configured explicitly around the structural setup of Philippine governance. The system scope encompasses the following features:

- **Relational Database Core (The Politician Persona):** Centralized profile structures tracking elected public figures through empirical variables: Full Name, Current Office, Region/Constituency, Bills Authored, Bills Passed, Budgets Allocated, and COA Audit Discrepancies.
- **Three-Tier Adjudication Pipeline:** A modular backend engine supporting community-based peer voting, administrative overrides, and definitive appeal tracking.
- **Dynamic Reputation Tracking:** Automated mathematical calculation loops that scale contributor editing privileges up or down based on verification historical data accuracy.
- **Tiered Sorting & Comparison Module:** Separate ranking matrices for the National Scope (Sitting Senators and Cabinet Secretaries) and Local Scope (Elected Officials belonging to the current, active administration term of Cebu City) alongside a percentage-normalized "Overall View" toggle.

### 5.2 Limitations of the Project

The functional boundaries of the system are constrained by external environmental factors, which include:

- **Temporal and Positional Bounding:** The platform tracks data generated strictly from the May 2022 election cycle up to the present year (2026). Candidate "runners" are strictly limited to the 2022 national campaigns. To maintain structural verifiability, local tracking is strictly bound to the active terms of the current administration within Cebu City.
- **Primary Source Dependencies:** The application operates strictly as a structural aggregator and translation layer. It cannot autonomously investigate politicians or verify instances where official public government bodies fail to update their data repositories.
- **Constitutional Neutrality Constraints:** The platform is explicitly restricted to historical factual logging and structural document summarization. It will not host opinion essays, subjective political predictions, or unverified claims.
- **Anti-Trolling Saturation Caps:** While a reputation-based framework mitigates localized bad actors, the platform remains vulnerable to severe, hyper-coordinated denial-of-service or mass-reporting attacks launched by highly funded professional troll syndicates.

### 5.3 Expected Contribution of the System

The platform bridges the "Interpretation and Transparency Gap" by introducing key structural improvements over current isolated solutions:

- **Elimination of Structural Silos:** Instead of forcing student voters to parse detached, complex, and unoptimized legislative or audit web pages, the platform aggregates fragmented historical footprints into a single searchable dashboard.
- **Mitigation of Democratic Clientelism:** By transforming abstract bureaucratic codes into accessible summaries, the system enhances baseline political media literacy among the youth. This structural access to historical track records provides voters with an alternative to relying heavily on emotional, biased, and viral social media propaganda or seasonal campaign narratives.
- **A Resilient Crowdsourcing Blueprint:** The project demonstrates an empirical design model for distributed digital moderation that actively prevents the destructive edit wars common on unprotected, open community-edited systems.