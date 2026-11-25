# PolitikApp post-usability implementation report

## A. Implementation summary

- **Module 1.** Profile links navigate immediately and fetch the selected profile by its database ID. The directory matches names across the full public dataset. Position and jurisdiction choices come from profile and Congress records. Active criteria hide the WGI Leaderboard. Profile sections have shareable URLs, and the Legislative Records tab loads ten authored bills at a time.
- **Module 2.** The feed shows stored, reviewed articles before requesting dashboard insights and waits for users to open a discussion before fetching comments. Summary and Read Original share a stable article ID. The original reader uses a centered reading column and preserves publisher paragraph and section boundaries when available. Back to news retains the feed search and page. Bookmark, comment, and vote controls use the existing authenticated services. Comment vote switches use a single transaction.
- **Across both modules.** Both layouts use the same application routes. Navigation labels stay visible, the existing logo keeps its aspect ratio, and dialogs support keyboard focus and dismissal. Score and leaderboard calculation code, database identifiers, and data relationships were preserved.

## B. Requirement completion matrix

| Requirement ID | Description | Priority | Status | Verification |
| --- | --- | --- | --- | --- |
| GLOBAL-01 | Use actual data | High | Implemented — Verification Pending | Reviewed runtime data paths and ran read-only checks against configured data. Authenticated writes on staging remain unverified. |
| M1-01 | View Profile | High | Completed | Selected a matching real result in Chrome and verified its profile, browser history, and invalid-ID handling. |
| M1-02 | Politician name search | High | Completed | Real first/last-name metadata, partial names, case, whitespace, empty results, and clearing were exercised through the API data and browser. |
| M1-03 | Position and jurisdiction filters | High | Completed | Chrome exercised data-derived options alongside search and reset, including a no-results case. |
| M1-04 | Search and filter visibility | Medium | Completed | Checked labeled controls, active chips, reset, and layout at eight browser widths. |
| M1-05 | Direct profile and section URLs | High | Completed | Opened the legislative route directly, navigated sections with history, and verified a nonexistent identifier state. Legacy query-style profile links still resolve. |
| M1-06 | Original record citations | High | Partially Completed | Stored URLs were present for all ten bills on the first page. Live availability returned unconfirmed for all ten. The interface labels this result and opens the stored official citation. |
| M1-07 | Profile tabs | Medium | Completed | Chrome verified isolated Overview, Accountability Records, and Legislative Records panels and direct navigation. Accomplishments have their own section. |
| M1-08 | Plain-language metric descriptions | Medium | Completed | Compared descriptions against existing methods and confirmed the accountability panel in Chrome. |
| M1-09 | Contextual terminology and help | Medium | Implemented — Verification Pending | WGI and efficiency explanations are inline and COA has an expandable explanation. Full keyboard and touch coverage of the methodology dialog remains pending. |
| M1-10 | Legislative pagination | Medium | Completed | Real API returned 210 distinct authored bills across 21 ten-record pages. Chrome navigated between pages, and the updated API returned the last ten bills. |
| M1-11 | Profile readability | Medium | Completed | Grouped biography, facts, records, sources, and actions. Profile sections and wrapping were checked in Chrome. |
| M1-12 | Neutral COA presentation | Medium | Implemented — Verification Pending | Reviewed slate styling and verified the record card assertions. A broader visual review across COA-heavy profiles remains pending. |
| M1-13 | Filter-aware WGI Leaderboard | High | Completed | Chrome verified default, whitespace-only, search, filtered, empty-result, and restored states. |
| M2-01 | Feed loading | High | Completed | Chrome started with one feed request and no comment prefetch. Real eight-item feed payload fell 77.5%. Warm response timings remained comparable. |
| M2-02 | News empty and error states | High | Partially Completed | Chrome verified real content, filtered empty state, transport failure, and recovery through Retry. The populated database did not allow verification of a globally empty feed. |
| M2-03 | Read Original action | Medium | Completed | Chrome opened the in-app original. The separate publisher link uses the article’s stored source URL. |
| M2-04 | Summary and original navigation | Medium | Completed | Chrome verified switching within the same article, browser history, and direct original routes. Back to news retained the search and page in the feed URL. |
| M2-05 | Bookmarks | High | Implemented — Verification Pending | Existing isolated regression suite passed. Chrome verified the guest prompt, and the updated API rejected unauthorized save and removal. Live account persistence remains unverified. |
| M2-06 | Comment submission | High | Implemented — Verification Pending | Existing isolated workflow test passed. Chrome exercised the guest discussion prompt. The updated API rejected unauthorized posting. Live account submission remains unverified. |
| M2-07 | Vote changes and counts | High | Implemented — Verification Pending | Isolated regression verified switching, idempotent repeat, removal, persisted selection, and authoritative counts. The live API rejected a guest write. Authenticated staging and concurrent real-account requests remain unverified. |
| M2-08 | Authentication prompts | Medium | Implemented — Verification Pending | Chrome verified bookmark and comment prompts, the sign-in route, and browser return. A successful post-login return and expired-session flow need an authorized account. |
| M2-09 | Original article formatting | Medium | Completed | The updated API restored 23 source paragraphs for the DBM article used in the usability report. Chrome verified a centered reading column, justified text on desktop, and left alignment on tablet and mobile. Legacy copies keep their saved text when the publisher structure cannot be verified. |
| M2-10 | Consistent news icons | Low | Completed | Reused the existing icon set and ran browser checks on reader, feed, and discussion controls. |
| M2-11 | Existing logo refinement | Low | Completed | Logo sizing, spacing, and aspect-ratio treatment were implemented and checked at representative widths. |
| M2-12 | Navigation labels | Medium | Completed | Visible labels and current-page indicators were checked in the desktop and mobile navigation. |
| M2-13 | Cross-module responsiveness | High | Partially Completed | Chrome checked 320, 375, 390, 425, 768, 1024, 1280, and 1440 px across the directory, legislative records, news feed, and original article. Authenticated interaction and admin layouts still need coverage. |
| M2-14 | Shareable news URLs | Medium | Completed | Chrome opened article and original URLs directly, used history, and verified the invalid article state. |
| M2-15 | Existing discussion and voting controls | Medium | Implemented — Verification Pending | Checked discussion visibility, loading, sign-in, and isolated backend engagement tests. Live authenticated usability still needs verification. |

## C. Root cause analysis

| Issue | Finding and resolution |
| --- | --- |
| Profile click and direct link | The click waited for the dashboard request. Cold loading first looked for the ID in the full directory. Navigation now sets the profile route immediately. A cancellable request resolves the URL’s ID, and failed or missing profiles have their own states. |
| Directory search and filters | The desktop view requested API matches and filtered them a second time using different fields. The filters also used fixed jurisdiction and office choices. Matching now runs once over the complete public directory and real Congress name metadata. Criteria live in the URL for browser history. |
| Original citations | The Congress UI suppressed valid stored citations whenever a live availability probe was inconclusive. The API now normalizes stored official URLs, and the UI distinguishes missing or known broken sources from unconfirmed reachability. All ten first-page checks were inconclusive in this environment. |
| News latency | The dashboard fetched the feed, a 50-item insights sample, summary statistics, and a comment request for each visible article. Feed responses also included full original text. The feed now loads first. Additional reads occur when needed, and the compact feed response leaves original text for detail reads. The existing aggregation job remains independent of public reads. |
| Empty news feed | Unexpected response shapes became empty arrays. The new response handling distinguishes an unexpected or failed request, cached results from an earlier success, a successful empty page, and a filtered empty state. The specific historical provider or configuration failure could not be reproduced. |
| Bookmarks | The original workflow relied on icon-only feedback, and feed/detail/saved entry points had separate state. Both article views now share labeled controls, write through the existing endpoint, and update the session-scoped cached records after success. The saved list links to the same reader. Database locks serialize concurrent saves and removals for the same user. |
| Commenting | The composer was behind an expandable panel with a generic Post action and a passive guest message. The form now labels the action, bounds and preserves drafts on failure, prevents duplicate clicks, and displays the API response within the correct discussion. An isolated regression confirmed the existing persisted submission path. The reported failure on a live account was not reproduced. |
| Voting | The UI disabled the opposite vote, and the old API contract rejected switching in one request. The new client sends the desired state, and the service locks the comment during the update and returns authoritative counts. The isolated regression exercised the existing comment fixture through both vote types and removal. |
| Mobile layouts | Icon-only desktop navigation, fixed control sizes, and oversized record sections reduced discoverability. Shared layouts now wrap tabs, paging controls, votes, and reading actions. Automated checks covered document overflow at eight widths. |
| Read Original formatting | The saved DBM body had no paragraph breaks and included publisher page chrome. The detail API returned that text as stored. The reader could display existing breaks but could not recover missing boundaries, and its narrow left-aligned column left unused space. Extraction now captures the publisher’s article body and semantic markup. The original-view endpoint can recover formatting for older copies after verifying the complete publisher body against the saved text. |

## D. Modified files

Paths below are relative to the repository.

| Files | Purpose |
| --- | --- |
| `frontend/src/App.jsx`, `config/appRoutes.js`, `routes/AppRoutes.jsx`, `routes/DesktopAppRoutes.jsx`, `mobile/routes/MobileAppRoutes.jsx` | Shared route parsing, profile loading, legacy URL resolution, history, sign-in return context, and route wiring. Paths after `App.jsx` are relative to `frontend/src/`. |
| `frontend/src/features/congress/politicianDirectory.js`, `useDirectoryFilters.js` | Search normalization, data-derived filters, and directory URL state. |
| `frontend/src/pages/Politicians/Politicians.jsx`, `Politicians.css` | Profile links, directory controls, result states, leaderboard visibility, and COA chip styling. |
| `frontend/src/pages/Profile/Profile.jsx`, `Profile.css` | Section routes, profile fallbacks, responsive layout, and record placement. |
| `frontend/src/components/governance/AccountabilityRecords.jsx`, `AuditSummaryCard.jsx`, `KPIWidget.jsx`, `positionConfig.js`, `CongressSourceSection.jsx` and `frontend/src/components/governance.css` | Neutral audit presentation, scoring explanations, citation rendering, and legislative paging. |
| `frontend/src/pages/Dashboard/Dashboard.jsx`, `Dashboard.css` | Feed request scheduling, filter URL state, failures and retry, persisted discussion and bookmark interactions, and touch controls. |
| `frontend/src/components/NewsArticleReader.jsx`, `NewsArticleReader.css`, `OriginalArticleBody.jsx`, `UserProfileMatrixPanel.jsx` | Route-driven article views, semantic article rendering, responsive reader typography, Back to news, and saved-list integration. |
| `frontend/src/components/AuthPromptModal.jsx`, `BaseModal.jsx`, `TopNav.jsx`, `TopNav.css` | Sign-in prompts, keyboard focus, navigation labels, and logo presentation. |
| `frontend/src/api/client.js`, `readCache.js`, `readRequest.js`, `useCachedRead.js`, `frontend/src/features/news/newsComments.js`, `newsArticleCache.js` | Bounded reads, HTTP status, cache scoping and article updates, and on-demand discussion requests. |
| `backend/src/main/java/com/politikapp/backend/congress/CongressPublicService.java` | Stable bill ordering and normalization of stored official citations. |
| `backend/src/main/java/com/politikapp/backend/news/controller/NewsController.java`, `news/dto/NewsDtos.java`, `news/service/NewsMapper.java`, `news/service/NewsService.java` | Optional compact feed, consistent publication checks, vote-state updates, and bookmark concurrency. Paths after the controller are relative to `backend/src/main/java/com/politikapp/backend/`. |
| `backend/src/main/java/com/politikapp/backend/auth/repository/AuthUserRepository.java`, `news/repository/NewsCommentRepository.java` | Row locks for engagement updates. The second path is relative to `backend/src/main/java/com/politikapp/backend/`. |
| `backend/src/main/java/com/politikapp/backend/news/service/SourceTextExtractor.java`, `GovernmentNewsRetrievalService.java`, `OriginalArticleService.java` | Extract and store sanitized publisher markup, then serve it or verify and recover the layout of older public articles. |
| `frontend/src/api/readRequest.test.js`, `frontend/src/features/congress/legislativeRecords.test.js`, `backend/src/test/java/com/politikapp/backend/news/NewsWorkflowIntegrationTests.java` | Updated assertions for bounded requests and source availability, and regression coverage for vote switching using the existing isolated fixture. |
| `docs/post-usability-checklist.md` | Implementation checklist, completion matrix, findings, and verification. |

## E. Testing results

- **Frontend.** Production build succeeded. All 70 automated tests passed. Lint reported zero errors and 91 warnings. Test setup printed Vite development-port and dependency-optimizer diagnostics while the local development server was running. The baseline had 69 of 70 tests passing. The failing assertion concerned the administrator verification label on accountability records and now passes.
- **Backend.** Maven ran 146 tests with 143 passed, 3 skipped, and zero failures or errors. The initial sandbox run could not download the Spring Boot parent POM. Maven ran successfully after approval. The existing integration suite used its isolated database.
- **Browser.** Headless Chrome used the existing local UI and real API data. Known-good profile and article routes, invalid identifiers, history, leaderboard hide and restore, pagination, guest prompts, filtered empty state, and feed failure recovery passed. The failure check blocked the real request at the browser transport layer and restored it before retrying.
- **Original article reader.** The updated read-only backend recovered 23 paragraphs from the actual DBM release. Headless Chrome checked 1440, 768, and 390 px for centered text, alignment, readable type and line spacing, and horizontal overflow. It also verified the Summary and Read Original links and the filtered return to News. Reader-specific lint and the final frontend build passed.
- **Read-only API.** The configured data contained 1,173 politician profiles and 38 published articles. All 210 legislative records were retrieved with distinct keys across 21 pages. The updated API loaded the original article text and rejected unauthorized bookmark creation, bookmark removal, commenting, and voting with HTTP 401.
- **Performance.** On the read-only instance the full eight-item news payload was 51,781 bytes and the compact payload was 11,673 bytes, a 77.5% reduction. Three warm samples ranged from 1,201 to 1,214 ms for full responses and from 1,206 to 1,228 ms for compact responses. The payload benefit was measured. A server latency improvement was not established.
- **Coverage limits.** There was no authorized staging account for live bookmark, comment, or vote writes. Representative viewport checks measured document overflow. They did not cover every device, authenticated admin screen, or assistive technology.

## F. Database and API changes

- `GET /api/news?view=feed` omits original text by returning `originalContent: null`. Default feed requests retain the full payload. `GET /api/news/{id}` still returns the original text. Pagination orders by publication date and then ID.
- `GET /api/news/{id}/original` returns sanitized publisher markup for public articles when available. New imports store the markup in existing source metadata. For older copies, the endpoint can verify the complete publisher body against the saved text and return the recovered structure without writing to the database. The reader falls back to saved text if recovery is unavailable.
- `POST /api/comments/{id}/vote` accepts an optional `active` boolean. Explicit `true` sets the requested vote or atomically switches to it. Explicit `false` removes that type if selected. Requests with only `voteType` retain legacy behavior. The response still carries persisted vote totals and selection.
- Existing bookmark and comment routes, IDs, and authentication are retained. Writes validate the authenticated user. The vote and bookmark changes use database row locks and existing keys. No schema migration, deployment configuration change, or new environment variable is required.
- Direct application URLs use existing Vite, nginx, and Vercel SPA fallbacks. The updated API verification instance was started with migrations, schema initialization, retrieval, and database writes disabled.

## G. No-mock-data compliance

The directory, profile dashboards, Congress and COA records, published news, summaries, and user interactions use the existing APIs and database models. The changes add no fabricated data, API stubs, replacement source URLs, or test fixtures. Read checks used existing records. Existing isolated automated tests kept their fixtures. No production deployment, migration, or data write occurred during verification.

Unavailable data has explicit loading, empty, retry, missing-source, or unconfirmed-source states. The source check and authenticated staging limits prevent claiming full integration verification.

## H. Remaining issues and recommendations

- Verify comment, vote, and bookmark persistence with authorized staging accounts, including multiple users, concurrent vote requests, post-login return, expired sessions, and mobile input.
- Recheck publisher reachability for the ten unconfirmed legislative citations and review any additional records with missing originals. Check a naturally empty feed when an authorized environment provides one.
- Older articles whose publisher page is unavailable or whose body no longer matches the saved copy display the saved text. The real DBM article was verified through a temporary read-only backend. An existing local backend process must restart to serve the new endpoint.
- The build still reports a large JavaScript chunk, and lint reports warnings. These are follow-up maintenance items.
- Unspecified new engagement features require team approval and a concrete proposal. The work here improves the existing discussion controls.
