# Congress profile population — completion report

Executed November 10, 2026 against the development connection configured in `backend/.env` (Supabase PostgreSQL). No production connection was selected. Dataset commit: `6e853ee027790427c5b5961c6318ff907cf717d5`.

## Verified results

| Measure | Result |
|---|---:|
| Source person records examined | 1,173 |
| Source people linked to public profiles | 1,171 |
| Newly created profiles | 1,145 |
| Existing profiles reused | 26 |
| Existing identity links retained | 23 |
| Additional existing profiles linked | 3 |
| Total profiles in the public directory | 1,175 |
| Membership relationships associated with linked profiles | 3,078 |
| Bill-to-person relationships associated with linked profiles | 167,863 |
| Distinct bills linked to those profiles | 103,953 |
| Total bills retained in the source tables | 165,162 |
| Historical bills newly imported | 159,128 |
| Existing bills preserved | 6,034 |
| Duplicate natural bill identities found | 0 |
| Linked people missing from the public directory | 0 |

The three newly matched existing profiles are Risa Hontiveros, Ferdinand Marcos Jr., and Tomas Osmeña. Their existing names, offices, terms, biographies, images, and other profile fields were preserved. Existing source links were retained rather than recreated.

New source-only profiles have `profile_origin=CONGRESS_DATASET` and `status=INACTIVE`; their current position, jurisdiction, party, personal term dates, biography, and image remain null. The UI identifies them as imported profiles with unverified current-office information. A Congress membership does not establish a personal term date or a current office.

Source-reported congressional records remain separate from independently curated accountability records and their KPI calculations. The import created no government projects, budgets, COA findings, accomplishments, or curated timeline entries.

## Data and schema

| Table | Use |
|---|---|
| `politicians` | Existing and newly populated public profiles; provenance field distinguishes imported profiles. |
| `open_congress_entities` | Stable person and bill IDs, current revision pointers, and person-to-profile identity links. |
| `open_congress_revisions` | Original payloads, bill numbers, titles, reported statuses, histories, source URLs, dataset commit/path, and import timestamps. |
| `open_congress_relationships` | Existing `MEMBER_OF` and `AUTHORED_BY` relationships; bills remain shared entities. |
| `open_congress_population_runs` | Transactional population audit reports. |

V26 relaxes the four mandatory office/jurisdiction/personal-date columns, adds profile provenance and population audit metadata, and adds a revision lookup index. It deletes no records or columns. Existing profile values were backed up before migration and checked after population.

The full immutable source snapshot was previewed before insertion. Source records were inserted in transactional batches of at most 1,000; committed batches can be resumed. Existing revisions were not overwritten. Profile creation, identity linking, source-cutoff expansion, and the population audit are one transaction.

The first profile transaction encountered a slow correlated query and rolled back; the public API still contained the original 30 profiles afterward. The query was replaced with the completed commit's import cutoff, and the successful resumed population reused all 166,574 already imported source entities. No historical bill had to be inserted again.

Authorship is displayed as reported authorship, never inferred sponsorship or enactment. Raw source author keys are retained for attribution; public bill lists and reported link totals deduplicate each bill/person pair. Membership display deduplicates the source chamber/Congress relationship while retaining original payloads.

## Unresolved source information

- Two person IDs have the same identifying name, **Mercedes C Cagas**, and different House author identifiers. They remain unlinked pending identity clarification: `01K5ST42W78Q5R4HR220WQNW7G` and `01K5ST42W9RDSQATVJJPNV7Q2N`. Their source records and four memberships remain preserved.
- **61,060 author-code relationships** lack a resolved source person. **61,126 bills** have no resolved author in the dataset. Those bills remain stored, with their source payloads and uncertainty flags; no person links were guessed.
- Jose Antonio G Lopez and Antonino P Roman have no supplied memberships. Both profiles were created and retrieved through the API. Lopez has no associated public Congress records; Roman has two legislative records. Missing memberships and personal dates remain empty.
- Raw coauthor text and legislative history remain available in source payloads. No additional coauthor identity or sponsorship relationship was inferred from an unstructured name.

## Verification

- A second source synchronization reported **166,574 unchanged entities**, with no source issues.
- An actual repeated profile population created **0** profiles, added **0** identity links, and recognized **1,171** existing links. Directory size remained **1,175**. Database checksums of every profile field and every person identity-link row were unchanged, including link timestamps.
- Public `GET /api/politicians` returned every one of the 1,171 linked profile IDs. The four other pre-existing profiles remain in the directory.
- Six representative profiles passed public detail, dashboard, Congress-history, and non-overlapping page-1/page-2 checks: Aquino III, Angara, Arroyo Jr., Hontiveros, Marcos Jr., and Osmeña. The two profiles without memberships were checked separately.
- Congress summary display preserves both chambers and sorts Congress numbers numerically. Bill numbers and source/dataset references are returned with legislative records. Unknown personal fields display safely.
- The unauthenticated population endpoint returned HTTP 401.
- Backend: **79 reported tests, 76 passed, 3 skipped, 0 failures/errors**. Frontend: **13 passed**; ESLint and production build passed. No browser E2E run was performed.

API verification used a temporary localhost-only backend on port 18081 with schema validation and automatic retrieval disabled. Restart an already-running development backend to load the updated DTOs and UI support.

## Files implemented or updated

- `backend/src/main/resources/db/migration/V26__allow_source_only_politician_profiles.sql`
- `backend/src/main/java/com/politikapp/backend/congress/CongressPopulationService.java`
- `backend/src/main/java/com/politikapp/backend/congress/CongressPopulationCommand.java`
- `backend/src/main/java/com/politikapp/backend/congress/CongressController.java`
- `backend/src/main/java/com/politikapp/backend/congress/CongressPublicService.java`
- `backend/src/main/java/com/politikapp/backend/politician/entity/Politician.java`
- `backend/src/main/java/com/politikapp/backend/politician/dto/PoliticianResponse.java`
- `backend/src/main/java/com/politikapp/backend/politician/dto/DashboardCompositeResponse.java`
- `backend/src/main/java/com/politikapp/backend/politician/dto/UpdatePoliticianRequest.java`
- `backend/src/main/java/com/politikapp/backend/politician/service/PoliticianMapper.java`
- `backend/src/main/java/com/politikapp/backend/politician/service/PoliticianService.java`
- `backend/src/main/java/com/politikapp/backend/politician/service/DashboardService.java`
- `backend/src/test/java/com/politikapp/backend/congress/CongressPopulationTests.java`
- `backend/scripts/populate-congress-profiles.ps1`
- `backend/scripts/verify-congress-population.ps1`
- `frontend/src/pages/Politicians/Politicians.jsx`
- `frontend/src/pages/Profile/Profile.jsx`
- `frontend/src/components/governance/PoliticianEditor.jsx`
- `frontend/src/components/governance/CongressSourceSection.jsx`
- `frontend/src/features/congress/congressHistory.js`
- `frontend/src/features/congress/congressHistory.test.js`
- `frontend/package.json`

## Reusable workflow and evidence

From the repository root, `backend/scripts/populate-congress-profiles.ps1` defaults to preview and backs up existing profiles and source links. Adding `-Apply` runs the same preview, additive migration, source synchronization, and population. It uses the configured local checkout and development `.env`; it does not fetch or execute upstream code.

The admin-only `POST /api/admin/open-congress/population` accepts a full dataset commit and optional `dryRun`; omission defaults to preview. This endpoint populates from already imported source records. Full source synchronization is handled by the command or the existing Congress import workflow.

Windows may require invoking the checked-in scripts through `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`; that affects only that process, not machine policy.

Backups, source previews/results, profile previews/results, and verification JSON are in `backend/target/congress-population/`. Key evidence:

- `2026-11-10T06-24-28.869447Z-source-result.json` — 159,128 historical source additions.
- `2026-11-10T08-15-50.407655700Z-profile-result.json` — successful profile population.
- `db-verification.json` — independent database reconciliation and bills per Congress.
- `api-verification.json` — public directory coverage and sampled endpoint checks.
- `idempotency-verification.json` — repeated execution and unchanged-field/link checksums.

These generated files are excluded from version control and can be removed by a clean build; copy the backup/evidence directory before cleaning `backend/target` if it must be retained.
