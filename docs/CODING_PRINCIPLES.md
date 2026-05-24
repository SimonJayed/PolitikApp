# PolitikApp Codebase Engineering Principles & Style Guide

**Document Status:** RELEASED / FULLY ALIGNED WITH SDD
**Target Phase:** Phase 3 MVP - 60% Vertical Slice Implementation Strategy

---

## I. Global Architectural Principles

### 1. The 60% Vertical Slice Boundary
* **Rule:** Every code artifact must prioritize connecting the data pipeline from end-to-end over building comprehensive edge-case handling.
* **Implementation:** * Frontend components must prioritize capturing form states and initiating API calls.
  * Backend layers must prioritize data ingestion, critical regex domain validation, and table persistence.
  * Secondary integrations (e.g., `AIParserService`) must handle timeouts gracefully using `handleParserTimeout()` to keep user sessions responsive.

### 2. Cross-Origin & Network Accessibility Setup
* Because developers are collaborating across separate hardware units pointing to a centralized host IP address over local Wi-Fi, Cross-Origin Resource Sharing (CORS) rules must be explicitly initialized.
* **Backend Configuration:** All Spring Boot REST controllers must include an explicit global cross-origin resource annotation:
  * Configuration Annotation: `@CrossOrigin(origins = "*")`
* **Frontend Endpoint Routing:** Frontend fetch/axios configurations must not utilize `localhost` references. They must dynamically point to the host machine's designated IPv4 address:
  * Current Host Target: `http://192.168.1.100:8080/`

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
To ensure a unified, professional user interface across all dashboards, all CSS modules and inline components must strictly adhere to the following typographic hierarchy scales:

* **Primary Application Font Stack:** `'Outfit', 'Elms Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
* **Main Section Headers (e.g., Politician Name, Dashboard Title):**
  * `font-size: 2.25rem;` (36px)
  * `font-weight: 700;` (Bold)
  * `line-height: 2.5rem;`
  * `color: #111827;` (Deep Charcoal)
* **Sub-Section Headers & Card Titles (e.g., KPI Titles, Timeline Cards):**
  * `font-size: 1.25rem;` (20px)
  * `font-weight: 600;` (Semi-Bold)
  * `line-height: 1.75rem;`
  * `color: #1f2937;` (Medium Slate)
* **Body Text & Summary Paragraphs (e.g., Impact Summary Blocks):**
  * `font-size: 1.0rem;` (16px)
  * `font-weight: 400;` (Regular)
  * `line-height: 1.5rem;`
  * `color: #4b5563;` (Muted Gray-Charcoal)
* **Micro Metadata & Timestamps (e.g., 'Assigned at' clock logs):**
  * `font-size: 0.875rem;` (14px)
  * `font-weight: 500;` (Medium)
  * `color: #6b7280;` (Muted Light Gray)

```javascript
// Reference React State Schema Structure (2-Space Indent)
const [formData, setFormData] = useState({
  politician_id: null,       // UUID/BIGINT target selector reference
  contributor_id: null,      // UUID/BIGINT tracking author credentials
  source_url: '',            // TEXT verified URL field
  category_tag: '',          // VARCHAR taxonomy selector
  action_identifier: '',     // VARCHAR operation code
  quantitative_metric: '',   // DECIMAL numerical tracking balance
  impact_summary: '',        // TEXT descriptive translation summary
  ai_generated: false        // BOOLEAN tracking if AI generator tool was used
});