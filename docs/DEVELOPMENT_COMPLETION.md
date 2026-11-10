# Development completion and verification

## Prioritized implementation plan

1. Connect complete retrieved drafts to the existing Gemini provider and administrator review; keep mock/failure output distinct and reject invalid transitions.
2. Exercise approved-source extraction and isolate source failures without weakening SSRF controls.
3. Validate accountability inputs and reconcile verified congressional timeline records with directory/profile metrics.
4. Preserve citations and provenance; stage independently checked records without overwriting existing data.
5. Run backend tests, frontend tests, lint and build; record external and deployment limitations.

## Runtime setup

- Runtime uses the existing PostgreSQL/Supabase schema and migrations; this change introduces no migration or startup data import.
- Configure database access, signing secret and allowed frontend origins using private deployment settings. Never commit actual credentials.
- For real Gemini processing, enable AI, disable mock mode, and configure the provider key and model. `AI_DISCOVERY_ENABLED=true` processes complete articles during retrieval; leave it false for administrator-triggered processing. Both paths return to pending review.
- Enable retrieval explicitly in the deployment and configure active sources in News Admin. Scheduled retrieval is separately disabled by default.
- New source hosts require explicit backend host approval. DOST and DA remain paused by existing policy; no access restriction is bypassed.
- Complete source excerpts can now be processed from the review panel. Metadata-only records remain blocked from AI processing and approval/publication.
- Published articles must retain reviewer, review time, and publication time. Editing invalidates approval. Reprocess only after unpublishing; reject pending/approved records. Publishing preserves the approving reviewer.
- Public comments remain account-linked internally and anonymous publicly. Existing vote behavior (take back a vote before switching direction) is preserved.

## Representative records

`data/representative-records.json` contains one source-checked historical legislative candidate and explicitly missing categories. The Senate page lists multiple filers, the filing date and presidential approval; no sole-authorship claim is made.

The candidate is not automatically imported. Its politician UUID and personal term association remain unverified because no local politician API was available. Match an existing verified profile, check for an existing source/action, review the official historical record, then submit only the nested request through the existing administrator workflow. The generic curation endpoint publishes immediately; do not use it as a preview.

`data/accountability-import-template.json` supplies intentionally incomplete request structures for projects/accomplishments, budgets, and COA findings. Do not replace missing values with zero or guessed facts. The official COA candidate page returned 403 during source inspection; no audit amount was copied from secondary reporting.

Primary evidence:
- https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1850 (historical source; carries an outdated-site warning).
- https://pco.gov.ph/other_releases/president-marcos-signs-new-agrarian-emancipation-act-ra-no-11953/ (corroborates enactment; not used as a budget allocation or individual legislative authorship claim).

## Validation boundaries

Backend integration tests use isolated H2 data and a mocked source HTTP transport; they do not bypass production SSRF validation. Provider tests mock only HTTP responses while exercising the real request/result processing and failure handling. Test fixtures are not factual political records and are never runtime seed data.

Frontend tests cover eligibility and summary-origin labels. They are not browser end-to-end or accessibility tests. Manual browser/UAT, actual Gemini quality, the deployed PostgreSQL schema and production hosting still require environment-specific validation.

## Completion checklist

| Requirement | Status | Evidence and remaining limitation |
| --- | --- | --- |
| Live AI and administrator review | PARTIAL | Configurable retrieval-to-AI and manual processing are connected. Provider-response, failure and API workflow regressions pass. On November 10, the provider identified the configured 2.5 Flash model as unavailable to new users. Updating to its recommended 3.8 Flash model removed the 404, but live generation returned HTTP 503 (high demand). Successful live generation remains unverified. |
| Source retrieval and extraction | PARTIAL | Read-only DBM RSS/article extraction passed. Source fixtures cover Senate/PIA paths, blocked sources and deduplication. This does not certify all configured sources; existing paused-source policy remains. |
| Representative political records | PARTIAL | All four existing accountability action types pass API/database integration with explicitly synthetic test fixtures. One real historical legislative candidate is staged, not imported; other factual categories and profile binding remain incomplete. |
| Citations and congressional provenance | PARTIAL | Parsed citation validation, forged-provenance rejection, invalid-link display, and verified-timeline metric reconciliation are tested. Existing external citations and deployed dataset coverage are not universally verified. |
| Public/admin workflows | PARTIAL | API/database tests exercise retrieval, AI fallback, approval/publication restrictions, anonymous commenting, voting, bookmarking, unpublication and record management. Manual browser, deployment and UAT checks remain. |

## Changes and API compatibility

- Existing Gemini service reused with injectable HTTP transport for focused tests, bounded structured-output validation, source-evidence checks, explicit model-unavailable errors, and private fallback handling.
- Complete deterministic drafts can be sent to AI from the review panel. Optional retrieval-time AI processing uses the existing discovery switch.
- Editing/reprocessing invalidates approval. Published articles must be unpublished before reprocessing; rejection is limited to pending/approved articles. Publication preserves the approving reviewer's identity.
- Public article access, interactions, personal collections and aggregate queries require publication with review metadata. Unreviewed extraction fields are excluded from public responses.
- New accountability writes validate required numeric fields, ranges, legislative dates/statuses, allowed citation hosts, and protected congressional provenance.
- Verified standalone congressional timelines contribute to directory/profile metrics without double-counting linked submissions or treating source-reported claims as verified contributions. Raw displayed counts are aligned while existing weighted score calculations are retained.
- Frontend navigation/ref issues and unresolved imports that blocked lint were repaired. A server-provided zero score is respected instead of being recomputed in the browser.
- Source-organization, external identifier and verification notes can be entered using existing record storage. No factual amounts or dates are generated by the application.
- No API routes were added or removed. Existing administrative news, source retrieval, public news and curation routes retain their payload shapes, with stricter validation and transition enforcement.
- No entity columns, migrations or production records were changed. The local ignored configuration's model selection was updated to a provider-advertised model; credentials and processing enablement switches were left unchanged. Provider generation remains unresolved.

## External checks and remaining work

- DBM live check: candidate discovery, relevant-article selection, full-text extraction and publication metadata passed through the approved-source HTTP client.
- Initial live source assertion incorrectly assumed the first feed entry would always be relevant; it now selects an eligible item instead of weakening relevance filtering.
- Live Gemini generation: the initial provider HTTP 404 was traced on November 10 to a model no longer available to new users, despite its models.list entry. The local model was updated to the provider-recommended `gemini-3.8-flash`. The subsequent live source-summary test reached that model but returned HTTP 503 (high demand). No successful live generation or AI quality claim is made. Provider errors now retain bounded, credential-redacted guidance, and model IDs accept the `models/` resource prefix.
- COA candidate page: HTTP 403; no findings or financial values inferred from secondary sources.
- Local public politician API was unavailable. No target database was populated or overwritten; representative data remains staged with an explicit missing-profile binding.
- Verify effective provider/account/model availability before enabling real generation. Retain manual review of failure excerpts and distinguish mock results from live results.
- Verify the existing Flyway history and actual PostgreSQL schema in the deployment environment before startup; tests use H2 and do not validate PostgreSQL migrations.
- Complete official-source data coverage and verified politician associations, then run browser checks, mobile/accessibility checks and UAT.
- Confirm administrator provisioning, HTTPS hosting, allowed origins, active source setup and recovery procedures in the intended deployment.

## Deployment readiness

The code is suitable for continued local functional testing and administrator validation. It is not certified ready for public MVP deployment: live provider generation, representative data coverage, production PostgreSQL/hosting verification, browser end-to-end checks and UAT remain outstanding.

## Final test results (November 9, 2026)

| Check | Result |
| --- | --- |
| Full backend suite, separate `completion` reports | 64 tests: 61 passed, 3 skipped, 0 failures/errors, Maven exit 0 |
| Frontend Node tests | 4 passed, 0 failed |
| Frontend lint | Exit 0; 0 errors and 31 warnings |
| Frontend production build | Exit 0; bundle-size warning remains |
| Live DBM source discovery/extraction | Passed |
| Live configured Gemini request | Model configuration corrected; latest live source-summary test failed with provider HTTP 503, and safe fallback kept the article pending review |
| Working-tree whitespace check | Passed; Git noted line-ending normalization for the rewritten integration test |
| Database migration compatibility | No migration/entity-column changes. Actual PostgreSQL/Flyway validation not performed |
| Browser/production/UAT | Not performed |

Backend assertions cover source transport/extraction fixtures, real MVC/JWT/H2 interactions, all four accountability categories, source links, record hiding, raw-count alignment, verified Congress inclusion, source-reported exclusion, provider malformed/unsupported/evidence/rate-limit/timeout failure cases, and public content visibility. Mock HTTP responses do not establish live provider availability.

The three default-suite skips are the two opt-in live checks and an existing check requiring a local congressional dataset clone. Live checks were run separately; the provider failure is intentionally recorded rather than relabelled as a successful integration. Historical reports under `target` were excluded from the final count; `*-completion.xml` reports identify this final run, excluding the separate live/AI suffixes.

## Files modified or added

- backend/.env.example
- backend/src/main/java/com/politikapp/backend/curation/service/AdminCurationService.java
- backend/src/main/java/com/politikapp/backend/curation/service/CivicRecordValidation.java
- backend/src/main/java/com/politikapp/backend/news/repository/NewsArticleRepository.java
- backend/src/main/java/com/politikapp/backend/news/repository/NewsCommentRepository.java
- backend/src/main/java/com/politikapp/backend/news/service/AdminNewsService.java
- backend/src/main/java/com/politikapp/backend/news/service/GovernmentNewsRetrievalService.java
- backend/src/main/java/com/politikapp/backend/news/service/NewsAiService.java
- backend/src/main/java/com/politikapp/backend/news/service/NewsMapper.java
- backend/src/main/java/com/politikapp/backend/news/service/NewsService.java
- backend/src/main/java/com/politikapp/backend/news/service/SourceTextExtractor.java
- backend/src/main/java/com/politikapp/backend/politician/service/DashboardMetricsService.java
- backend/src/main/java/com/politikapp/backend/politician/service/PoliticianMapper.java
- backend/src/test/java/com/politikapp/backend/curation/service/CivicRecordValidationTests.java
- backend/src/test/java/com/politikapp/backend/news/NewsWorkflowIntegrationTests.java
- backend/src/test/java/com/politikapp/backend/news/service/GovernmentNewsDiscoveryLiveTests.java
- backend/src/test/java/com/politikapp/backend/news/service/NewsAiProviderTests.java
- backend/src/test/java/com/politikapp/backend/politician/AccountabilityWorkflowIntegrationTests.java
- backend/src/test/java/com/politikapp/backend/politician/VerifiedTimelineMetricsTests.java
- backend/src/test/java/com/politikapp/backend/submission/EditSubmissionControllerTests.java
- docs/data/accountability-import-template.json
- docs/data/representative-records.json
- docs/DEVELOPMENT_COMPLETION.md
- frontend/package.json
- frontend/src/App.jsx
- frontend/src/components/governance/EditSubmissionForm.jsx
- frontend/src/components/governance/KPIWidget.jsx
- frontend/src/components/governance/TimelineLedger.jsx
- frontend/src/components/NewsArticleReader.jsx
- frontend/src/features/news/newsWorkflow.js
- frontend/src/features/news/newsWorkflow.test.js
- frontend/src/features/news/sourceReference.js
- frontend/src/features/news/sourceReference.test.js
- frontend/src/pages/AdminNews/AdminNews.jsx
- frontend/src/pages/Compare/Compare.jsx
- frontend/src/pages/Dashboard/Dashboard.jsx
