# WGI leaderboard restoration

## Plain-language UI revision — November 13, 2026

The current UI explains Worldwide Governance Indicators and PolitikApp’s own office-weighted, records-based score directly below the heading. Featured cards and full-ranking rows label values **WGI Score**. Valid calculated zero is shown as **0.0 / 100**; profiles without eligible records say **Not yet scored** and receive no WGI rank. The existing top-three/expandable layout and navy theme remain.

**How are scores calculated?** opens a beginner-friendly explanation of contributing bills, projects, tracked budgets and COA deductions; higher scores; the 0–100 limit; and valid zero versus missing records. It explicitly explains that office weights/eligible factors can make the attainable maximum lower than 100, and that rankings are not an objective verdict on overall performance. Existing normalization, weights, penalties and tie-break details remain available in a collapsed disclosure. Keyboard/touch-accessible information tips explain the scale and missing scores inline.

The scoring implementation and this document were inspected before these presentation changes. `DashboardMetricsService` and `WgiLeaderboardService`, the scoring formula, database and actual scores were not modified. Frontend validation: 70 tests passed; ESLint has zero errors and 31 existing warnings; production build passed. Browser checks passed for calculated zero/unscored labels, explanation dialog, focus/Escape tooltips, responsive tooltip bounds at 1280/768/390/320px, expansion, navigation and live score updates. Only isolated fixture scores were used. No commit or deployment was performed.

Implemented November 12, 2026. No commits, pushes, merges, deployments, migrations, or Supabase record changes were performed.

## Recovery and integration

The previous implementation remains in `frontend/src/components/PoliticianRankingPanel.jsx`. Its Git history was inspected, including `2743f49` (ranking decimal fix) and `7c389ec` (KPI/ranking calculation). The old panel's ranking/tie-break behavior was recovered. Its presentation was recreated as a compact leaderboard rather than reactivating its browser-side fallback calculations, which could turn absent data into zero scores and omitted actual flagged-fund inputs.

The existing navy Politicians header/count is preserved. Immediately below it, the leaderboard follows the supplied layout: three compact photo cards, then a separate Full WGI rankings panel with position/jurisdiction rows and a full-width expansion control. Scored profiles appear first. Remaining slots use real profiles in the same unfiltered default order as the directory, without duplicates. Missing scores display WGI —; featured unscored slots say Position rather than Rank. View Full Leaderboard and Show More reveal 20 additional profiles; Collapse returns to six. No fictional politicians or scores are inserted.

The next section is titled **Browse All Politicians**. Its existing cards, ordering, search, position/Congress/jurisdiction filters, bottom-centered pagination, and profile navigation are preserved. Directory state and leaderboard state/fetching are independent.

## Scores and missing data

Scores use the existing `DashboardMetricsService` through the same `PoliticianMapper` calculation path as profile/directory responses. The formula, reference ceilings, position weights, legislation status weighting, project completion weighting, and COA penalties were not changed. Only the mapper's existing record-to-response method visibility was relaxed from private to package scope so the service can reuse it.

There is no newly persisted WGI score column or ranking table. Scores are derived from published profile submissions and verified timeline records. As in the existing metrics path, timeline entries mirrored from submissions are not counted twice; source-reported imported claims are excluded. Supported actions are sponsored legislation, project completion, budget allocation, and COA findings, subject to the existing office/action compatibility rules.

A profile needs at least one eligible contributing record and a finite computed score in the existing 0–100 range to receive a rank. A real calculated zero is valid. A profile with no eligible records is **Not Available**, not zero. NaN/out-of-range scores and archived profiles receive no rank. The UI fills unscored places with real directory profiles; an empty state appears only when no profiles are available. Directory numeric zero defaults are never used to infer score eligibility. Existing directory/profile response formats and their legacy numeric defaults are unchanged.

The read-only Supabase probe using the actual repositories, mapper, and scorer found **1 ranked profile and 1,174 unranked public profiles** at inspection time. The leaderboard therefore keeps that scored profile first and fills the other five initial slots from the default directory order, using WGI — for missing scores. Probe sessions were read-only; neither the Spring runtime nor Flyway was started.

## Ranking and ties

Order is descending by the unrounded backend WGI score. Equal scores restore the previous panel's secondary order:

1. More bills.
2. More projects.
3. Higher tracked budget.
4. Fewer COA findings.
5. Name, with profile UUID as a final deterministic fallback.

Ranks are sequential after those tie-breaks, matching the previous panel's behavior. Displayed scores are rounded to one decimal; matching displayed values may therefore have different underlying scores. Unscored profiles retain the directory order: current highest offices first, then current Senate and House members, then former members; alphabetical ordering within office groups is preserved.

## Scoring transparency

Methodology opens an existing-style modal. It explains Worldwide Governance Indicators, PolitikApp's project-specific adaptation, the existing position-weighted formula and normalization/COA rules, contributing records and supporting citations, excluded records, tie handling, valid zero versus missing data, and limitations from incomplete records, different office weights, and time served.

The modal explicitly distinguishes the project's individual-official metric from an official World Bank rating. It does not label politicians as objectively best/worst or imply that audit flags alone prove personal wrongdoing.

The API returns the calculation time for each response, plus the latest contributing system-record timestamp for each ranked entry when known. The UI labels both appropriately, uses Manila time, and shows Not Available for absent source timestamps. The visible page polls the read-only leaderboard API every 15 seconds and also refreshes on focus, reconnect, or visibility restoration. Requests stop on unmount and polling skips hidden pages. Existing scores remain visible if a background request fails; an inline retry notice explains the failure. Expanded depth and directory search, filters, and pagination are preserved.

## API and efficiency

New public GET endpoint:

```text
/api/politicians/leaderboard?offset=0&limit=6
```

`offset` must be nonnegative; `limit` must be 1–50 (default 8). The page includes entries, totalRanked, unrankedCount, offset, limit, hasMore, and calculatedAt. Each entry includes rank, politicianId, fullName, position, jurisdiction, profileImageUrl, wgiCompositeScore, and sourceUpdatedAt.

The service selects only potential scoring candidates through EXISTS queries, loads contributing submissions/timelines in batches, and reuses the current scorer. It does not issue per-profile metric queries or download a second 1,175-profile directory. Global sorting is performed over calculated candidate scores, then the response is paginated. Because scores are derived, computing a global order still requires evaluating all scoring candidates; a persisted score/cache system was deliberately not introduced.

No security configuration change was needed: existing public politician GET access covers this endpoint. No new dependencies, tables, or migrations were added.

## Files in this change

Created:

- `backend/src/main/java/com/politikapp/backend/politician/service/WgiLeaderboardService.java`
- `backend/src/main/java/com/politikapp/backend/politician/controller/WgiLeaderboardController.java`
- `backend/src/test/java/com/politikapp/backend/politician/WgiLeaderboardIntegrationTests.java`
- `frontend/src/components/WgiLeaderboard.jsx`
- `frontend/src/components/WgiLeaderboard.css`
- `frontend/src/features/congress/wgiLeaderboard.js`
- `frontend/src/features/congress/wgiLeaderboard.test.js`
- `frontend/scripts/browserHarness.mjs`
- `frontend/scripts/test-wgi-leaderboard-browser.mjs`
- `docs/WGI-leaderboard-restoration.md`

Modified:

- `backend/src/main/java/com/politikapp/backend/politician/repository/PoliticianRepository.java`: candidate selection and public-profile count queries.
- `backend/src/main/java/com/politikapp/backend/politician/service/PoliticianMapper.java`: reuse the existing mapping/scoring method without formula changes.
- `frontend/src/pages/Politicians/Politicians.jsx`: leaderboard placement and Browse All Politicians heading.
- `frontend/package.json`: leaderboard rendering tests and optional browser test command.

Earlier uncommitted accomplishments, directory, landing-page, and network-retry changes were preserved.

## Verification

- Backend leaderboard integration: **6 tests passed**. Covers descending order, score parity with existing profiles, valid zero, historical tie-breaks, name ordering, missing/invalid/archived/source-only exclusions, hidden/draft/incompatible records, no double counting, public access, pagination bounds, and no writes by GET.
- Complete backend suite: **110 tests total, 107 passed, 3 existing tests skipped**, with no failures/errors. Skipped checks require the local Congress clone or opt-in live news/Gemini settings.
- Frontend suite: **46 tests passed**. New tests cover missing/invalid scores, zero, one-decimal display, top-three/additional rows, profile-button/photo rendering, invalid rank exclusion, scored-first/default fallback ordering, deduplication, and no invented scores.
- Headless Chrome: passed top-three/additional rendering, expand/show-more/collapse, profile navigation, methodology, unscored fallback/error/retry behavior, automatic score reordering through the polling callback, focus/reconnect refresh, retention of previous scores after failed updates, independence from directory search/position/pagination, and widths 1280/768/390/320px. Browser data is an isolated API fixture; it never creates production records.
- ESLint passed with **0 errors and 31 existing warnings**.
- Frontend production build passed; existing bundle-size/plugin-timing advisories remain.
- Backend packaging passed after the full suite. The fresh `backend/target/backend-0.0.1-SNAPSHOT.jar` was inspected and contains the new leaderboard controller/service. It was not started or deployed.
- Read-only live scoring probe passed against Supabase with the current scorer and schema. No production data was created to populate rankings.

Optional browser command from `frontend`:

```powershell
$env:CHROME_PATH = 'C:\path\to\chrome.exe'
npm.cmd run test:browser:wgi
```

## Release requirements and limitations

Deploy/restart the updated backend before exposing the new frontend request. Keep the existing Supabase configuration and previously applied migrations intact; this change has no new migration. A frontend connected to an older backend will show a retryable leaderboard error while the independent directory remains usable.

Scores are computed on request rather than stored in historical snapshots. The frontend automatically reloads all currently requested score pages on its next refresh cycle, allowing newly eligible scores and rank changes to replace the loaded order without a page reload. Each API page is limited to 50 entries. Data can still change between successive API pages because the API does not provide a multi-request database snapshot. Source timestamps reflect contributing records, not proof of source freshness or complete performance coverage. Unscored leaderboard positions now use the default politician directory order as requested. They are explicitly distinguished from calculated WGI ranks; no data is generated to fill them.

No application runtime or deployment was started during implementation. Local backend packaging, tests, and frontend builds are not deployments.
