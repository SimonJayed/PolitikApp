# PolitikApp — System Overview, Recent Features & Backend Recovery Plan

**Document Date:** October 23, 2026  
**Session Context:** Hand-off guide and system briefing for the upcoming session.  
**Location:** Workspace Root (`SESSION_SUMMARY_AND_PLAN.md`) — *Not in `docs/` per instruction.*

---

## 1. Executive Summary

- **Frontend:** Healthy. React 19 + Vite 8 builds cleanly in ~4.5s (`npm run build` passing with 0 errors).
- **Backend Tests:** 30/30 unit & integration tests passing (`mvnw test` passing using H2 in-memory mode).
- **Backend Runtime Status:** Currently **BLOCKED from starting** due to a missing environment configuration placeholder (`JWT_SECRET`) and a classpath dependency scope restriction for offline local mode (`org.h2.Driver`).
- **Target Resolution Time:** < 5 minutes to restore full backend functionality.

---

## 2. Core System Architecture

**PolitikApp** is an empirical governance platform tracking Philippine elected officials (Senators, Representatives, Governors, Mayors). It gathers data on bills authored/passed, budget allocations, Commission on Audit (COA) audit findings, and World Governance Indicators (WGI).

### Tech Stack
| Tier | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8, Vanilla CSS | History API deep-linking, tabbed dashboard, Lucide icons |
| **Backend** | Spring Boot 3.5.14, Java 17 | Spring Security (Stateless JWT), JPA/Hibernate 6, Flyway 11 |
| **Database** | PostgreSQL 17.6 (Supabase Pooler) | Local H2 fallback for tests and offline development |
| **Observability** | Spring Boot Actuator | `/actuator/health` and `/actuator/info` |

### Package Architecture (Domain-Driven)
The backend was recently refactored from legacy numbered modules (`module1`, `module2`, `module3`) into clean domain packages under `com.politikapp.backend`:
- **`auth`**: Stateless JWT issuance/validation, user registration, role management (`CONTRIBUTOR`, `PEER`, `ADMIN`).
- **`curation`**: Administrative moderation queue, dispute adjudication, appeals.
- **`politician`**: Politician entity management, KPIs, audit findings, budget allocations, ranking queries.
- **`reputation`**: Contributor trust score tracking, trust decay/rewards, moderation audit logs.
- **`submission`**: Citizen data submissions and source URL verification.
- **`news`**: Automated government news aggregation, Gemini AI synthesis, citizen discussions.
- **`config`**: Security configuration, CORS whitelisting, IP rate limiting.

---

## 3. Newly Added Features Breakdown

### A. AI Government News Aggregator & Admin Portal
- **Automated RSS Ingestion (`GovernmentNewsRetrievalService`):**
  - Scrapes official government RSS feeds (pre-seeded with the *Official Gazette of the Republic of the Philippines*).
  - Normalizes news titles, publication dates, summaries, and source URLs.
- **Gemini AI Synthesis (`NewsAiService`):**
  - Summarizes governance articles and classifies them into categories (`EXECUTIVE`, `LEGISLATIVE`, `JUDICIARY`, `POLICY`, `ELECTIONS`).
  - Supports Google Gemini 1.5 Flash when `GEMINI_API_KEY` is present.
  - Automatically falls back to deterministic mock synthesis when `AI_MOCK_MODE=true` or offline.
- **Citizen Engagement Features:**
  - Threaded news comments (`NewsComment`) with upvote/downvote mechanics (`CommentVote`).
  - User bookmarks via `SavedPost`.
- **Admin News Management Dashboard:**
  - Dedicated admin UI (`AdminNews.jsx`) and REST API (`AdminNewsController`) for reviewing scraped feeds, editing, approving, archiving, and maintaining audit logs (`NewsAuditLog`).
- **Flyway Migrations `V19` to `V22`:**
  - `V19`–`V21`: Created tables and indexes for news articles, government sources, comments, votes, and audit logs.
  - `V22`: Cleaned up legacy schema by replacing the old `contributors` table with a unified, role-based `users` table.

### B. Security & Rate Limiting Hardening
- **Endpoint Rate Limiting (`RateLimitingFilter`):**
  - IP bucket rate limits applied to sensitive endpoints:
    - Auth login (60 req/min)
    - Auth register (20 req/min)
    - Data submissions (30 req/min)
    - Challenge filings (30 req/min)
- **Security & Actuator Configuration:**
  - Whitelisted Actuator health endpoint (`/actuator/health`).
  - Parameterized CORS configuration for local Vite development (`http://localhost:5173`, `http://127.0.0.1:5173`).

### C. Frontend & UI Overhaul
- **Restored Modern Auth Pages:** Clean login/register interface in `frontend/src/auth/AuthPages.css` and `AppRoutes.jsx`.
- **Refined Dashboard (`Dashboard.jsx`):** Tabbed interface with high-level KPI cards, empirical summary statistics, and integrated AI news feed widgets.
- **Dispute Challenges (`ChallengeRecordModal`):** Citizen modal to lodge disputes against metric records.
- **User Account & Profile Pages (`Account.jsx`):** Modernized profile management and reputation view.

---

## 4. Root Cause Analysis: Why the Backend Won't Work

### Blocker 1: Missing `JWT_SECRET` (Fails Default / Supabase Runtime)
- **Symptom:** Running `.\mvnw.cmd spring-boot:run` crashes during Tomcat startup with:
  ```text
  Caused by: org.springframework.util.PlaceholderResolutionException: 
    Could not resolve placeholder 'JWT_SECRET' in value "${JWT_SECRET}" <-- "${app.auth.jwt.secret}"
      at com.politikapp.backend.auth.security.JwtService.<init>
  ```
- **Root Cause:**
  - `backend/src/main/resources/application.properties` (line 27) declares:
    `app.auth.jwt.secret=${JWT_SECRET}`
  - In `backend/.env`, only database credentials are set; `JWT_SECRET` is omitted.
  - Because there is no default fallback value specified, Spring Boot aborts bean instantiation.

### Blocker 2: Missing H2 Driver on Runtime Classpath (Fails Local Profile)
- **Symptom:** Running with the local profile (`spring.profiles.active=local`) configured in `application-local.properties` crashes with:
  ```text
  Caused by: java.lang.IllegalStateException: Cannot load driver class: org.h2.Driver
  ```
- **Root Cause:**
  - In `backend/pom.xml`, H2 is scoped strictly to `test`:
    ```xml
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>test</scope>
    </dependency>
    ```
  - When the developer runs the app locally outside of `mvn test`, H2 is excluded from the runtime classpath.

### Advisory 3: Remote Supabase Flyway Version Drift
- **Symptom:** Connecting to Supabase logs:
  `Schema "public" has a version (23) that is newer than the latest available migration (22) !`
- **Context:** The remote Supabase database had an experimental migration `V23` recorded in `flyway_schema_history`. While `spring.flyway.validate-on-migrate=false` currently prevents a fatal boot failure, strict validation will fail if enabled.

---

## 5. Tomorrow's Action Plan & Recovery Steps

### Step 1: Add `JWT_SECRET` to `backend/.env`
Open `backend/.env` and append the missing JWT key:
```properties
JWT_SECRET=politikapp-super-secret-key-must-be-at-least-32-bytes-long
```

### Step 2: Add Fallback in `backend/src/main/resources/application.properties`
Change line 27 in `backend/src/main/resources/application.properties` to:
```properties
app.auth.jwt.secret=${JWT_SECRET:politikapp-super-secret-key-must-be-at-least-32-bytes-long}
```
*Benefit: Prevents the backend from crashing if anyone launches the app without a local `.env` file.*

### Step 3: Enable H2 for Local Runtime in `backend/pom.xml`
In `backend/pom.xml`, change the H2 dependency scope from `test` to `runtime`:
```xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
```
*Benefit: Allows developers to launch the backend completely offline using `application-local.properties` without needing access to Supabase.*

### Step 4: Verification Commands
Once the fixes are applied:

1. **Verify Backend with Cloud Supabase:**
   ```powershell
   cd backend
   .\mvnw.cmd spring-boot:run
   ```
   *Expected:* Tomcat boots on port `8080`, connects to Supabase, and logs `Started BackendApplication in X seconds`.

2. **Verify Backend Health Endpoint:**
   ```powershell
   curl http://localhost:8080/actuator/health
   ```
   *Expected:* `{"status":"UP"}`

3. **Verify Local Offline Mode (Optional):**
   ```powershell
   $env:SPRING_PROFILES_ACTIVE="local"
   .\mvnw.cmd spring-boot:run
   ```
   *Expected:* Boots with embedded H2 database in PostgreSQL compatibility mode.

4. **Verify Frontend:**
   ```powershell
   cd frontend
   npm run dev
   ```
   *Expected:* Vite dev server available at `http://localhost:5173`.

---

## 6. Next Session Priorities

1. **Apply Backend Fixes (Steps 1–3 above)** to get the API server running live.
2. **Execute Full-Stack Integration Smoke Test:**
   - Test user registration and login flows.
   - Verify that news articles display on the dashboard from `GovernmentNewsRetrievalService`.
   - Test the Admin News curation panel at `/admin/news`.
3. **Execute Containerization Plan:**
   - Consult `DEPLOYMENT_AND_DOCKER_PLAN.md` to containerize backend (`Dockerfile`), frontend (`Dockerfile` + Nginx reverse proxy), and launch via `docker compose`.
