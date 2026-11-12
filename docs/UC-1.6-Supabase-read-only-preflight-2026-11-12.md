# UC-1.6 Supabase deployment preflight

Inspected November 12, 2026, approximately 8:00 PM Asia/Manila. The target was the Supabase database configured in this checkout's `backend/.env`. This does not establish the settings of a separate hosting provider or database copy.

## Decision

**V27 is already applied. Do not apply its SQL again.** Its recorded Flyway checksum matches this checkout and its table, constraints, index, and row-level security match the migration. The current source/entity mappings are compatible with this database. A fresh application build is still required before deploying UC-1.6.

No migration, repair, clean, application startup, data mutation, commit, push, or deployment was executed during this review. The inspection used catalog/history SELECT queries, Flyway `info`/`validateWithResult`, and Hibernate schema validation. The final schema audit explicitly checked `transaction_read_only=on` and `default_transaction_read_only=on` for its database sessions. Session-local read-only/time-limit settings were used; no persistent database settings were changed.

The previously reported pending V27 status is superseded by this live inspection. The audit does not establish who applied V27.

## Applied migration history

| Version | Current Flyway state | Stored checksum | Finding |
| --- | --- | --- | --- |
| V23 | DELETED | 1825947749 | Historical SQL entry plus existing DELETE marker. Not a pending migration; do not restore/reapply or repair. |
| V24 | SUCCESS | 726243068 | Matches the local migration. |
| V25 | SUCCESS | -1159970399 | Matches the local migration. |
| V26 | SUCCESS | 836149347 | Matches the local migration. |
| V27 | SUCCESS | 577843881 | Matches `V27__create_politician_accomplishments.sql`. |

V27's stored timestamp is **2026-11-12 11:57:27.583533 UTC**, equivalent to **November 12, 2026, 7:57:27 PM Asia/Manila**. It was present when the inspection read the history.

V11 is also historically DELETED. V1 has the existing baseline and baseline-ignored source state. Flyway 11.7.2 validated **28 migrations successfully**, including the existing baseline/history arrangement. No pending or failed migration was reported. Both the initial validation and subsequent default validation passed; no repair or checksum override was used.

### Historical filename differences

These differences exist between stored `script` metadata and current source filenames:

| Version | Stored history script | Current source filename |
| --- | --- | --- |
| V14 | `V14__add_jurisdiction_lookup_tables.sql` | `V14__admin_curation_and_challenges.sql` |
| V19 | `V19__rename_contributors_to_users.sql` | `V19__create_government_news_feed.sql` |
| V20 | `V20__drop_username_from_users.sql` | `V20__repair_government_news_feed_schema.sql` |

These are real historical metadata differences and should be retained in the audit record. Flyway accepts their current resolved migrations: no checksum/description validation errors were returned. They are not grounds to repair history or rename already-applied scripts during this deployment. This approval applies to the exact validated checkout; rerun validation if migration resources change.

## Schema conflicts and dependencies

- `public.politician_accomplishments` already exists as the V27-owned table. Its primary key and `idx_accomplishments_politician_visibility` index exist. Rerunning raw CREATE TABLE SQL would conflict with those objects.
- All 11 accomplishment columns match their expected types, lengths, nullability, and defaults: UUID IDs, title varchar(200), description text, optional date/year/category, source varchar(2048), visible boolean, and timestamptz creation/update columns.
- Expected primary key, politician foreign key, nonblank title/description/source checks, 5,000-character description bound, year range, and date-or-year constraint exist.
- `politicians.politician_id` is a non-null UUID primary key. The foreign key is valid; no orphan accomplishments were found.
- The visibility index has the expected `(politician_id, visible, created_at DESC)` definition.
- Row-level security is enabled and not forced. No accomplishment RLS policies or custom table triggers were found. The configured backend role owns the table and has BYPASSRLS, so Spring's database access works while public access continues through the API's JWT/role and visibility checks. Replacing that role with a restricted role would require a separate grant/RLS review.
- V27 contains additive table/index/security DDL only; it contains no UPDATE, DELETE, TRUNCATE, DROP, or existing-record backfill. UUID generation occurs in the application, so V27 does not require a new UUID extension.
- Supabase has existing platform event triggers, including RLS handling. No changes were made to them. Actual applied objects were checked instead of assuming the migration checksum alone proves schema compatibility.

Observed counts: 1,175 politicians, 79 timeline records, 2 profile submissions, 57 news articles, and **0 accomplishments**. Counts were the same in the two inspection passes. These observations do not prove that historical content was never changed by other actors; this audit made no content changes.

## Backend compatibility

- PostgreSQL 17.6 accepted the read-only inspection.
- The current datasource credentials connected successfully; the effective database schema is `public`.
- The local configuration uses the `supabase` profile, `JPA_DDL_AUTO=validate`, and `FLYWAY_ENABLED=true`; no process-level overrides of those checked settings were found.
- Hibernate 6.6.49 schema validation passed for **all 15 current JPA entities**, including Accomplishment. No Spring application context, scheduler, or retrieval job was started for this check.
- The checked role has schema access and accomplishment table CRUD privileges with the current RLS setup.
- Keep the existing credentials/configuration private. Check the actual deployment environment separately; it must point to this same database and preserve the intended profile, JWT secret, CORS/API origin, and database permissions.

**Artifact issue:** the existing local `backend/target/backend-0.0.1-SNAPSHOT.jar` is stale. It contains V24/V25 but not V26/V27 or the accomplishment classes. Do not deploy that JAR. Build a fresh release from the reviewed source. This finding concerns the local artifact, not an assertion about what is running on a remote host.

## Exact deployment sequence — instructions only

The following actions were not executed. Use them only when deployment is separately authorized.

1. Record the current backend/frontend image digests or release artifacts and environment configuration, and confirm the available Supabase backup/restore point. Do not overwrite the previous release tag with the new image before recording a rollback reference.
2. Immediately before rollout, rerun read-only history validation against the deployment database. Require V23 DELETED; V24–V27 SUCCESS; V27 checksum 577843881; no pending/failed/mismatched migration; and the expected table/index/RLS. If anything differs, stop and investigate. Do not repair.
3. Keep the validated V27 file unchanged. Do not run its raw SQL, the V25-specific Congress helper, Flyway repair/clean/baseline, or Hibernate update/create/create-drop. There is no migration left to apply to this database.
4. Build fresh backend and frontend artifacts from the exact reviewed source. The repository's base Docker Compose path is:

   ```powershell
   docker compose build backend frontend
   ```

   If the running deployment uses additional Compose files (for example the Congress dataset mount), include **the same existing `-f` files and mounts** in every build/up command. If hosting is not Compose-based, build through that host's equivalent release process; do not assume the local Compose environment represents that host.
5. Verify the backend deployment environment: `SPRING_PROFILES_ACTIVE=supabase`, `JPA_DDL_AUTO=validate`, `FLYWAY_ENABLED=true`, and the already-verified database credentials. `SPRING_FLYWAY_TARGET=27` can pin this release to its reviewed migration ceiling; any future migration deployment must deliberately update that setting. Do not switch to the local/H2 profile. Preserve existing secrets, CORS settings, and Congress mount/configuration.
6. Roll out the backend first using the reviewed image. For the base Compose configuration:

   ```powershell
   docker compose up -d --no-deps backend
   docker compose logs --tail 100 backend
   Invoke-RestMethod -Uri 'http://localhost:8080/actuator/health'
   ```

   Flyway will validate/inspect its resources at startup; because V27 is already SUCCESS, it should not execute V27 again. Hibernate must validate successfully. Require health UP and no Flyway/schema errors before continuing. A fresh preflight is still essential because startup normally has migration privileges.
7. Before changing the frontend, perform read-only endpoint checks using a known non-archived politician UUID:

   ```powershell
   $profileId = '<existing non-archived politician UUID>'
   Invoke-RestMethod -Uri "http://localhost:8080/api/politicians/$profileId/accomplishments"
   ```

   Expect an empty JSON array at the current data state. Verify the administrator list with an existing valid administrator token without printing it. Check guest/non-admin access to the administrator GET endpoint returns 401/403. Do not test production create/edit/hide unless a later instruction expressly authorizes test records; exercise those mutations in staging.
8. Roll out the frontend only after backend readiness:

   ```powershell
   docker compose up -d --no-deps frontend
   ```

   Check the public Accomplishments empty state, administrator Add/Manage controls, and existing profile/Congress/civic record sections. Confirm the frontend API origin/proxy reaches the updated backend. Read-only inspection can verify controls but cannot prove deployed mutation behavior; use a staging environment for that final test.
9. Recheck Flyway history and the accomplishment schema after rollout. It should still show one successful V27 SQL entry with the same checksum, and no unexpected migrations. Confirm existing record counts have not changed unexpectedly, allowing for legitimate concurrent activity.

For a JAR-based release, build a new artifact with `./mvnw.cmd clean package` from `backend` and build the frontend with `npm.cmd ci` / `npm.cmd run build` from `frontend`. Do not use the currently stale target JAR. Starting the JAR is a deployment operation and was not performed by this preflight.

## Rollback considerations

- Prefer **application rollback** to the recorded compatible prior backend/frontend release. Leave the additive V27 table, its data, and Flyway history intact.
- A prior backend release may accept V27 as a future migration, but verify that exact release's Flyway settings and schema compatibility in staging. Do not assume every historical JAR is safe merely because V27 is additive.
- Roll back or disable the new frontend section together with a backend that lacks accomplishment endpoints; otherwise those API requests will fail. Preserve the prior image digest/configuration and required Congress mounts.
- There is no automatic Flyway SQL undo migration in this change. Do not delete the V27 history row, modify its checksum, or drop the table as an application rollback shortcut.
- The table is empty now, but it may contain real data after deployment. Dropping it would destroy those records. A database-level rollback would require a separate reviewed plan, explicit approval, and backup consideration. Prefer a forward corrective migration if a schema defect is discovered.
- For an untouched database copy where V27 truly remains pending, its DDL should run through normal transactional Flyway migration after that copy's own preflight. A failed standard transactional PostgreSQL migration normally rolls back its DDL, but inspect both schema and history afterward; never infer a safe retry or repair from the failure alone. This is not the state of the inspected database.

## Remaining limits

No production writes or runtime deployment were tested. Hibernate validation checks mappings, not application behavior or every possible database invariant; explicit catalog checks covered the new table's constraints/index/RLS. The audit establishes compatibility for the current code, configured database, and role at inspection time. It does not validate another environment, an old artifact, future configuration changes, or a future changed migration file.
