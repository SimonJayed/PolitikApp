# Legislative and verified-record improvements

Implemented on `main`, November 13, 2026. No commits, pushes, merges, deployments, production record changes, identity-link changes, or migration changes were performed.

## 1. Changes implemented

The profile now has two distinct public sections:

- **Legislative Records**: dataset-reported authored bills, grouped and filterable by Congress, with compact Senate/House membership summaries.
- **Browse verified records**: administrator-curated Project Completion, Budget Allocation, COA Audit Findings, and Accomplishments, sharing search, type filtering, totals, and pagination of nine records per page.

The existing navy, white, and light-blue styling is retained. Titles, authorship, categories, verification labels, metrics, dates, descriptions, and citations use separate blocks with consistent spacing. Desktop, tablet, and mobile layouts were checked.

## 2. Authorship, counts, and pagination

The existing Congress query already joins `open_congress_relationships` using `AUTHORED_BY`, scoped through the imported person linked to the requested politician. It does not use co-authorship, sponsorship, or loose bill associations.

Previously, the public total and paginated rows also included memberships. The service now separates memberships before calculating bill totals and applying pagination. An optional Congress filter on the existing endpoint is applied before pagination; the response also supplies the available Congress numbers across authored bills. Missing Congress numbers remain explicitly unavailable.

Administrator-approved source snapshots additionally require an `AUTHORED_BY` relationship for that politician and the snapshot's exact source revision. Approving a source update cannot invent authorship or expose another person's authored bill. The frontend also checks `type === BILL`, `relationshipType === AUTHORED_BY`, and an exact `authorPoliticianId` match.

All stored memberships remain intact. The public display condenses supported memberships into summaries such as “Senate: 15th and 16th Congresses.” Membership cards and empty reported-position labels are absent from the main bill list.

## 3. Dataset links and integration

Visible Dataset Record links were removed from public bill cards and the shared public timeline renderer. Public citation rendering also suppresses BetterGovPH GitHub TOML links if one appears in a historical primary-citation field. There is no dataset-link fallback for an unavailable government source.

Dataset provenance links remain available in the administrator-only pending-source review tools. Dataset URLs, revisions, payloads, authorship relationships, memberships, statuses, filing dates, histories, and source snapshots remain stored. The import/parser, retrieval, linking, approval, and draft-verification services remain enabled. Existing ingestion/parser and related integration tests passed; no ingestion was run against Supabase.

## 4. Original Source links

Original government URLs are selected from the URLs already present in the imported record. The display no longer assumes that the first stored URL is necessarily a government citation. It does not manufacture replacement addresses or rewrite stored URLs.

Confirmed sources use ordinary external anchors with `target="_blank"` and `rel="noopener noreferrer"`. Query separators and special characters are retained; literal spaces in historical paths are encoded for transport. Tests cover Senate query strings containing both `congress` and `q`, and PDF names containing `!`.

The sampled [legacy Senate bill page](https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=16&q=SBN-2145) returned HTTP 403 to automated retrieval. Retrieval of the sampled [Senate PDF](https://web.senate.gov.ph/lisdata/4767343688!.pdf) could not be confirmed by the browsing tool. These results do not establish that the documents were deleted or cannot be reached by every browser. The previous anchors already opened new tabs; an upstream access failure cannot be fixed by changing anchor labels.

Availability is now checked in the background through the existing Congress-record endpoint, using the optional `checkSources` parameter. Record text renders before the checks complete. Checks use HTTP HEAD, a small ranged GET if HEAD is unsupported, bounded redirects and timeouts, and a bounded memory cache with two-minute expiry. Responses are closed without downloading full documents. Only public government destinations are checked; credentials, non-web schemes, non-government redirects, and local/private network targets are rejected.

Confirmed links become clickable. Invalid/missing links and unconfirmed/inaccessible sources display **Original source unavailable**, with an explanation that this can mean the check was blocked or unsuccessful. No claim of independent content verification is made. No availability results or URL changes are written to the database. Pending administrator review retains its stored original link and explicitly labels its availability as unchecked.

No API endpoint was added. The existing `/api/politicians/{id}/congress-records` accepts optional `congress` and `checkSources` parameters and supplies authorship/availability metadata.

## 5. Titles, statuses, and legislative history

All-capital bill titles receive presentation-level casing without changing the stored title. Bill numbers use SB/HB when the chamber is known. Authorship appears on a separate line as “Authorship: Source-reported author.” Congress, filing date, reported status, and status date have explicit labels.

History/status normalization handles JSON strings, arrays, text entries, description/action/text fields, nested action collections, and dated maps. Empty objects, blank descriptions, and date-only items do not produce empty numbered entries. Parent dates are retained for nested descriptions. Fully dated histories sort chronologically; undated or mixed histories retain source order. Available histories remain expandable; missing histories show **Legislative history unavailable**.

The source-reported disclaimer stays visible. Administrative approval of a dataset revision is described as review for display, not independent verification.

## 6. Browse verified records and administration

Project cards show a valid 0–100% completion value. Budget and COA cards show the allocated/flagged amount in Philippine pesos, including legitimate zero values. Missing, invalid, and out-of-range values remain unavailable rather than becoming invented zeros. Descriptions, categories, verification labels, and supporting citations remain separate and readable. COA cards explicitly state that an audit finding does not by itself establish personal wrongdoing.

Visible accomplishments join the same public listing and can be searched by title, description, category, date, or year. Hidden accomplishments stay out of the listing. Their existing add/edit/hide interface and source/date storage remain intact.

Curated Sponsored Legislation and membership entries are excluded from the public accountability listing. **Manage published records** still lists curated Sponsored Legislation with the existing edit and remove controls. Imported bills and curated legislation are never automatically merged. No records were deleted, migrated, overwritten, or reclassified in Supabase. WGI scoring and its underlying records were not changed.

## 7. Modified files

Backend changes:

- `backend/src/main/java/com/politikapp/backend/congress/CongressPublicService.java`
- `backend/src/main/java/com/politikapp/backend/congress/OriginalSourceService.java` (new)
- `backend/src/main/java/com/politikapp/backend/politician/controller/PoliticianDashboardController.java`
- `backend/src/test/java/com/politikapp/backend/congress/CongressPublicServiceTests.java` (new)
- `backend/src/test/java/com/politikapp/backend/congress/OriginalSourceServiceTests.java` (new)

Frontend changes:

- `frontend/src/api/congress.js`
- `frontend/src/features/congress/legislativeRecords.js` (new)
- `frontend/src/features/congress/accountabilityRecords.js` (new)
- `frontend/src/features/congress/legislativeRecords.test.js` (new)
- `frontend/src/components/governance/CongressSourceSection.jsx`
- `frontend/src/components/governance/AccountabilityRecords.jsx` (new)
- `frontend/src/components/governance/AccomplishmentsSection.jsx`
- `frontend/src/components/governance/TimelineLedger.jsx`
- `frontend/src/pages/Profile/Profile.jsx`
- `frontend/src/pages/Profile/Profile.css`
- `frontend/scripts/test-profile-records-browser.mjs` (new)
- `frontend/scripts/test-accomplishments-browser.mjs`
- `frontend/package.json` (test commands only; no dependencies added)
- This report.

## 8. Validation

- Complete backend suite: **119 tests, 116 passed, 3 existing skips, zero failures/errors**. Tests use isolated H2 data or mocks, with production migrations disabled. Existing opt-in/local-dataset tests account for the skips.
- New backend coverage: authored-only selection for the correct politician, exclusion of co-authors/sponsors/other authors, membership-independent totals and pagination, Congress filtering, source/provenance/history preservation, read-only behavior, and source-check success, caching, redirects, missing/blocked sources, HEAD fallback, and transport failure.
- Frontend suite: **55 tests passed**. Covers authorship checks, title/history/status formatting, public dataset-link removal, original-link attributes, source-unavailable states, accounting values, accomplishment visibility, and public record filtering.
- Profile Chrome fixture: passed authored bill counts/pagination/Congress filtering, compact memberships, removal of public dataset links, original-link handling, nonempty histories, currency/percentage display, accomplishment/search/type/pagination behavior, and retained curated-legislation admin edit/hide actions. Checked widths **1280, 768, 390, and 320 px**.
- Existing accomplishment Chrome workflow: passed create/edit/hide, duplicate-submit protection, public visibility/citations, responsive width, and preservation of the surrounding biography. Selectors were updated for accomplishments' new public location inside Browse verified records.
- ESLint: **0 errors, 31 existing warnings**.
- Production frontend build: passed. Existing bundle-size/tooling advisories remain.
- `git diff --check`: passed.

Browser workflows use fixture API data, not production records. Screenshots in `.tmp/srs-review/legislative-records-desktop.png` and `.tmp/srs-review/verified-records-desktop.png` were visually inspected.

## 9. Remaining limitations and rollout

The updated backend must be running before the updated frontend uses the new authorship/count/source-check metadata. Restart or deploy it only as a separately authorized step. No runtime restart or deployment was performed here.

Government sites may block automated requests, require browser access, time out, or change after a successful check. The application therefore cannot guarantee continued availability or establish document deletion from a failed request. It preserves the original data and reports uncertainty instead of inventing a working URL. Availability checks are cached, so an upstream change may not appear until a later request after expiry.

All-capital title casing is a display aid; the source text remains authoritative. Unknown acronyms or unusual capitalization may still need review. Missing dates, legislative histories, and statuses remain explicitly unavailable. Administrator verification still requires human source review; these UI changes do not establish the truth or completeness of the source-reported claims.
