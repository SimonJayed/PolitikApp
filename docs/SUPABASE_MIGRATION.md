# Supabase Migration & Connection Guide

This guide describes how to connect the PolitikApp Spring Boot backend to a cloud-hosted Supabase PostgreSQL instance safely, with zero data loss and without breaking changes.

---

## 1. Schema Migration Files

The complete, production-ready, idempotent schema is located in:

```text
supabase/migrations/20260906000000_politikapp_supabase_complete_schema.sql
```

This file replaces the outdated initial V1 file and consolidates:
- All 8 core tables: `contributors`, `politicians`, `profile_edit_submissions`, `moderation_queue`, `timeline_entries`, `jury_votes`, `reputation_audit_logs`, `peer_applications`.
- Legacy attribute preservation: `quantitative_metric` is retained as a nullable column alongside `action_details JSONB`.
- Safe JSON-to-numeric synchronization trigger with regex filtering and exception handling (zero runtime cast crashes).
- Harmonized status check constraints supporting both legacy and modern curation lifecycles.
- Seed data for fallback spoofer admin (`88bc8912-43ba-4abc-882a-ef92481aa323`).
- Flyway schema history pre-registration (V1 through V15) to prevent the `baseline-version=14` trap.

---

## 2. Deploying Schema to Supabase

### Method A: Supabase Dashboard SQL Editor (Recommended)
1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click on **SQL Editor** in the left sidebar.
3. Open `supabase/migrations/20260906000000_politikapp_supabase_complete_schema.sql` in your editor, copy the entire file contents, and paste it into the Supabase SQL Editor.
4. Click **Run** (or `Ctrl+Enter`).
5. Confirm that the query executes with `Success. No rows returned`.

### Method B: Supabase CLI
If using the Supabase CLI:
```powershell
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

---

## 3. Backend Connection Configuration

The backend contains the Supabase profile configuration in:
```text
backend/src/main/resources/application-supabase.properties
```

### Understanding Supabase Pooler Ports
Supabase provides two ports on its connection pooler:
- **Port 5432 (Session Mode)**: Full PostgreSQL session state support. Supports table locks, Flyway migrations, and stateful operations. **Use this port for Spring Boot with Flyway**.
- **Port 6543 (Transaction Mode)**: Stateless PgBouncer connection sharing. Does **not** support server-side prepared statements (requires `prepareThreshold=0`) or Flyway advisory locks.

### Recommended Connection String & Environment Variables
In PowerShell, set your environment variables before launching the application:

```powershell
# 1. Database Connection URL (Pointing to Session Pooler on Port 5432 with recommended flags)
$env:DATABASE_URL="jdbc:postgresql://<POOLER_HOST>:5432/postgres?sslmode=require&prepareThreshold=0&preparedStatementCacheQueries=0&preparedStatementCacheSizeMiB=0&tcpKeepAlive=true&reWriteBatchedInserts=true&connectTimeout=10&socketTimeout=30"

# 2. Supabase Database Username and Password
$env:DATABASE_USERNAME="postgres.<YOUR_PROJECT_REF>"
$env:DATABASE_PASSWORD="<YOUR_SUPABASE_PASSWORD>"

# 3. Hibernate Schema Validation & Flyway Flags
$env:SPRING_PROFILES_ACTIVE="supabase"
$env:JPA_DDL_AUTO="validate"
$env:FLYWAY_ENABLED="true"

# 4. Start the Backend
cd backend
.\mvnw.cmd spring-boot:run
```

### Critical JDBC Connection Flags Explained
- `prepareThreshold=0`: Mandatory when using PgBouncer poolers to prevent `prepared statement "S_1" does not exist` errors.
- `preparedStatementCacheQueries=0` & `preparedStatementCacheSizeMiB=0`: Disables driver statement caching to avoid collision across pooled connections.
- `tcpKeepAlive=true`: Prevents cloud firewalls and AWS NAT gateways from dropping idle connections silently.
- `reWriteBatchedInserts=true`: Accelerates bulk write performance and Flyway migration execution.
- `JPA_DDL_AUTO=validate`: Ensures Hibernate verifies entity mappings against the database schema without altering it.

---

## 4. Avoiding the `baseline-version=14` Trap

- **If you applied `20260906000000_politikapp_supabase_complete_schema.sql`**: The script already registers versions 1 through 15 in `public.flyway_schema_history`. When Spring Boot boots with `spring.flyway.enabled=true`, Flyway reads the history table, recognizes that all migrations are complete, and proceeds cleanly without skipping or re-running.
- **If you connect to an existing database**: Never set `baseline-version=14` on a database that only has V1 tables. Doing so causes Flyway to skip V2 through V14, omitting `peer_applications`, `reputation_audit_logs`, and all new columns. Apply the complete schema script first.
