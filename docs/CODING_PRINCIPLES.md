# PolitikApp Codebase Engineering Principles & Style Guide

**Document Status:** RELEASED / FULLY ALIGNED WITH 2.0 ARCHITECTURE  
**Target Architecture:** 2.0 Centralized Evidence-Based Admin Curation & Public Disputes  

---

## I. Global Architectural Principles

### 1. Zero-Trust & End-to-End Data Integrity
* **Rule:** All mutating requests (submissions, citizen challenges, profile edits) must strictly authenticate the caller via JWT and derive author identities from security context—never from client request bodies.
* **Implementation:**
  * Frontend components must capture form states, validate domain whitelists (.gov.ph / .edu.ph), and handle authenticated/guest sessions cleanly.
  * Backend layers enforce role-based access control, input validation, and transactional persistence.
  * Public endpoints (e.g. politician directories, timelines, metrics) remain read-accessible to unauthenticated guests to ensure maximum civic transparency.

### 2. Environment Configuration & Network Routing
* Do not hardcode static IPv4 addresses or machine-specific network locations.
* **Backend Configuration:** Security rules and CORS are managed centrally in `SecurityConfig.java` and `application.properties` via configurable allowed origins.
* **Frontend Endpoint Routing:** Frontend API clients must rely on environment-driven base URLs (`import.meta.env.VITE_API_URL` or Vite proxy paths) with sensible fallbacks:
  * Default Local Development: `/api` or `http://localhost:8080`

---

## II. Frontend Code Style Conventions (React/JavaScript Core)

### 1. File & Folder Structural Naming
* **Component File Names:** Written using `PascalCase` (e.g., `EditSubmissionForm.jsx`, `PoliticianDashboard.jsx`).
* **Reusable Utility Components:** Written using `PascalCase` (e.g., `SourceUrlInput.jsx`, `KPIWidget.jsx`, `TimelineLedger.jsx`).
* **Utility/Helper Files:** Written using `camelCase` (e.g., `urlValidator.js`).

### 2. State & Variable Naming Standards
* All localized component reactive states, processing variables, and internal functions must strictly utilize `camelCase` (e.g., `formData`, `handleSubmit`).
* Data payloads constructed within frontend methods must identically map properties to match the backend ingestion transfer schemas to prevent data mapping failures.

### 3. Typography & UI Layout Style System
To ensure a unified, professional, and premium user interface across all dashboards, all CSS modules and style structures must strictly utilize the dynamic design tokens and layout classes declared in [App.css](file:///frontend/src/App.css):

#### A. Core Style System & Design Tokens (`App.css` Root Variables)
* **Tailored Colors (Curated Slate-Teal Palette):**
  * `--bg-page`: `#f3f7f9` (Light gray-blue canvas background)
  * `--bg-surface`: `#ffffff` (Pure white card face surface)
  * `--bg-soft`: `#f7fafc` (Soft cool-gray block fill background)
  * `--line-soft`: `#dbe5ea` (Subtle boundary border line)
  * `--line-strong`: `#c7d4dc` (Highly visible separator outline)
  * `--text-primary`: `#10212b` (Deep obsidian/navy primary text)
  * `--text-secondary`: `#4b6271` (Cool charcoal secondary text)
  * `--text-muted`: `#6e8594` (Muted steel metadata text)
  * `--accent`: `#0f766e` (Standard brand deep teal)
  * `--accent-strong`: `#115e59` (Hover brand teal highlight)
  * `--accent-soft`: `#e6f7f4` (Light teal backdrop accent)
* **Dynamic Radii & Shadows:**
  * `--radius-sm`: `10px` | `--radius-md`: `14px` | `--radius-lg`: `18px` | `--radius-xl`: `24px`
  * `--shadow-xs`: `0 1px 2px rgba(16, 33, 43, 0.06)`
  * `--shadow-sm`: `0 6px 18px rgba(16, 33, 43, 0.06)`
  * `--shadow-md`: `0 12px 30px rgba(16, 33, 43, 0.1)`
* **Micro-Animations & Transitions:**
  * `--motion-fast`: `180ms` | `--motion-base`: `260ms` | `--motion-slow`: `360ms`
  * `--motion-ease`: `cubic-bezier(0.22, 1, 0.36, 1)`
  * Hover standard for card components (`.dashboardCard`, `.politicianRow`, `.compareCard`):
    ```css
    transition: transform var(--motion-fast) var(--motion-ease),
                box-shadow var(--motion-fast) var(--motion-ease),
                border-color var(--motion-fast) var(--motion-ease),
                background-color var(--motion-fast) var(--motion-ease);
    ```

#### B. Typographic Hierarchy Scales
* **Primary Application Font Stack:** `'Outfit', 'Elms Sans', system-ui, sans-serif`
* **Main Section Headers (e.g., `.topBar h1`, `.profileHero h2`):**
  * `font-size: clamp(1.55rem, 2vw, 2.2rem);` (35px - 44px)
  * `font-weight: 800;` (Extra Bold)
  * `color: var(--text-primary);`
* **Moderation & Curation / Detail Headers (e.g., `.mod-header h2`, `.timeline h2`):**
  * `font-size: 1.2rem;` (19.2px)
  * `font-weight: 800;`
  * `color: var(--text-primary);`
* **Sub-Section Headers / Cards Title Block (e.g., `strong` label inside `.dashboardCard`):**
  * `font-size: 1.08rem;` (17.3px)
  * `font-weight: 800;`
  * `color: var(--text-primary);`
* **Body Text & Summary Paragraphs (e.g., `.timelineItem p`, `.biographyBlock p`):**
  * `font-size: 0.96rem;` (15.4px)
  * `line-height: 1.58;`
  * `color: var(--text-secondary);`
* **Micro Metadata & Timestamps (e.g., `small` metadata labels):**
  * `font-size: 0.84rem;` (13.4px)
  * `font-weight: 600;`
  * `color: var(--text-muted);`

```javascript
// Reference React State Schema Structure (2-Space Indent)
const [formData, setFormData] = useState({
  politicianId: '',          // camelCase target selector reference
  sourceUrl: '',             // camelCase verified URL field
  categoryTag: 'Audit',      // camelCase taxonomy selector
  actionIdentifier: 'COA_FINDING', // camelCase operation code
  quantitativeMetric: '',    // camelCase numerical tracking balance
  impactSummary: ''          // camelCase descriptive translation summary
});
```

### 4. Reusable Modal & Confirmation Interaction Standards
All high-stakes confirmations (appeals, destructive actions, irreversible actions) must use a reusable in-system modal component. Native browser dialogs (`window.alert`, `window.confirm`, `window.prompt`) are prohibited in production UI flows because they break visual consistency and interaction control.

#### A. Reusable Modal Contract
* Implement and use a shared component (example: `ConfirmActionModal` or `BaseModal`) with:
  * Controlled open state (`isOpen`)
  * Title/body/CTA slots (`title`, `description`, `confirmLabel`, `cancelLabel`)
  * Severity variant (`neutral`, `warning`, `danger`)
  * Async loading/disabled state support for submit actions
* Mandatory behavior:
  * Close on `Escape`
  * Backdrop click to dismiss (except while submitting)
  * Body scroll lock while open
  * Focus handoff to modal on open, return focus to trigger on close

#### B. Visual Alignment Rules
* Modal layers must reuse system classes and tokens from `App.css`:
  * Backdrop: subdued overlay with no neon hues
  * Surface: `var(--bg-surface)`, border via `var(--line-soft)`, shadow via `--shadow-md`
  * Radius: `--radius-lg` for modal container
  * Buttons: primary action uses `--accent`; destructive action may use the danger token family where applicable
* Keep headings/body/meta typography aligned with Section II.3.B scale.

### 5. Dashboard Ranking & Leaderboard Styling Standards
Tiered ranking views are first-class dashboard elements and must follow a reusable, data-dense pattern aligned with Module 1 objectives.

#### A. Placement & Scope
* Render leaderboard content inside the Dashboard view, not as a standalone disconnected screen.
* Support separate ranking scopes:
  * National
  * Cebu City
* Include an explicit sort basis indicator (example: Efficiency, Budget, COA flags).

#### B. Visual Structure
* Use a reusable leaderboard component (example: `PoliticianRankingPanel`) with:
  * Ranked rows (`#`, politician identity block, KPI cells, trend/flag cell)
  * Sticky header on scrollable ranking container
  * Alert badge when `coaAuditDiscrepancies > 0`
* Ranking rows must use design tokens already defined in `App.css` and preserve existing card/list spacing rhythm.

#### C. Interaction + Responsiveness
* Desktop: tabular row layout with compact KPI columns for scanability.
* Mobile: stacked row layout preserving rank visibility and primary metric first.
* Clicking a ranked row should navigate to that politician profile/dashboard context.

---

## III. Backend Architecture & Code Conventions (Spring Boot / Java)

### 1. Domain-Driven Bounded Context Organization
The backend is strictly organized by business domain contexts rather than academic module numbers or monolithic flat layers:
* `com.politikapp.backend.politician`: Politician profiles, biographical details, legislative timelines, comparative matrix analysis, and WGI indicator scoring.
* `com.politikapp.backend.submission`: Citizen evidence proposals, primary source URL whitelisting (`.gov.ph` / `.edu.ph`), and submission intake.
* `com.politikapp.backend.curation`: Administrative adjudication queue, citizen public disputes / challenges, appeals, and timeline publication.
* `com.politikapp.backend.reputation`: Contributor trust scoring, audit logging, and automated account standing safeguards.
* `com.politikapp.backend.auth`: Identity, JWT session tokens, and security principal resolution.
* `com.politikapp.backend.common`: Cross-cutting concerns including `GlobalExceptionHandler`, API response wrappers, and domain events.
* `com.politikapp.backend.config`: Spring Security, rate limiting filters, CORS configuration, and database seeders.

### 2. Domain Internal Structure
Each domain package encapsulates its own components with standard subpackages:
* `controller`: REST endpoints with clear resource naming and validation annotations.
* `service`: Business logic, transaction boundaries (`@Transactional`), and mappers.
* `repository`: Spring Data JPA repository interfaces extending `JpaRepository`.
* `entity`: JPA entity classes mapping directly to PostgreSQL schema tables.
* `dto`: Immutable request payloads and response transfer objects (prefer Java `record`s).
* `event`: Domain event listeners and dispatchers.

### 3. Cross-Domain Communication
* Cross-domain operations must interact through service interfaces or domain events (e.g., `SubmissionCreatedEvent`, `ReputationEventListener`), avoiding tight circular coupling.
* Common entities like `Politician` and `ProfileEditSubmission` are imported cleanly across bounded contexts where required (such as `curation.service` publishing to `politician.entity.TimelineEntry`).
