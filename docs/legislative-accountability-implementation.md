# Legislative accountability

PolitikApp now supports administrator-curated attendance, individual votes, and committee assignments on the legislative profile view. The existing Open Congress import continues to provide source-reported memberships and authorship. The new records are independent of that import, the existing accountability timeline, and WGI scoring.

## Public and administrator views

- Attendance shows the chamber, numbered Congress, official session reference, date and status. Present, absent, excused and unavailable are distinct. The coverage summary groups records by Congress and chamber, includes all matching pages, and calculates present ÷ (present + absent). It excludes excused and unavailable sessions and labels the result as coverage of recorded sessions. With no eligible denominator, the percentage is unavailable.
- Votes show the measure title, roll-call reference, date and recorded decision. Choices are Yes, No, Abstained, Absent and Unknown. Committee records show the committee, chairperson, vice-chairperson or member role, Congress and any substantiated dates.
- Public views show verified, active records and their sources. Administrators can list drafts, create or edit records, withdraw them from public display, and restore them by saving a revised record. Private evidence notes and reviewer identities stay in the administrator view. The editor starts in Pending verification and needs a deliberate decision and an official citation with evidence notes to publish.
- The desktop and mobile views preserve the existing legislation tabs. Executive profiles without applicable legislative history or verified records keep those sections hidden for visitors. A verified accountability entry can make the legislative section available for an executive with prior service.

## API and storage

| Method | Route | Function |
| --- | --- | --- |
| GET | `/api/politicians/{politicianId}/legislative-accountability` | Published records, filters and attendance coverage |
| GET | `/api/politicians/{politicianId}/legislative-accountability/{recordId}` | One published record |
| GET, POST | `/api/admin/politicians/{politicianId}/legislative-accountability` | Administrator list or create |
| PUT, DELETE | `/api/admin/politicians/{politicianId}/legislative-accountability/{recordId}` | Edit or withdraw using the current revision |

Lists accept `kind`, `chamber`, `congress`, `offset` and `limit`. The public list includes coverage summaries for `kind=ATTENDANCE`. A record belongs to one politician, chamber and numbered Congress. Validators enforce type-specific decisions and fields, date boundaries, and the corresponding chamber’s official domain. Display links are cleaned of known tracking parameters. Verification is an administrator’s evidence review. The service does not make outbound requests. Concurrent edits use a revision check, and a database uniqueness constraint rejects duplicate normalized session, vote or committee keys.

V30 adds `public.legislative_accountability`, a foreign key to `politicians`, publication constraints, and an index for profile browsing. PostgreSQL enables row-level security and revokes direct table grants from `PUBLIC` and the usual Supabase Data API roles, including `service_role`. A trusted backend connection must have the required table and RLS access. The migration is additive and inserts no records.

The `legislative-accountability` Spring profile opts in to V30 and retains V29’s migration location. **Treat separately approved V29 as a prerequisite.** Enabling this profile below V29 lets Flyway discover both migrations. In an approved rollout, verify V29 is already installed, back up the target, and test the migration and effective role permissions on a private PostgreSQL restore. Use `app.legislative-accountability.enabled=false` during schema and role checks, retain all installed migration locations, then enable the feature after approval. With no migration and the feature disabled, the public list reports unavailable and administrator operations are disabled.

## Evidence guidance

- Use the named roll-call lines of the applicable journal for attendance. Record Excused only when the source documents an excused status or official leave. Use Unavailable when the named status cannot be determined. For example, the 20th Congress Senate Journal for Session 60 lists Bam Aquino among those who answered roll call on May 5, 2026. That is evidence for one Present entry. [Senate Journal 60](https://legacy.senate.gov.ph/lisdata/4979845652%21.pdf) · [Senate rules](https://legacy.senate.gov.ph/Rules%20of%20the%20Senate-October%202024.pdf) · [House journals](https://www.congress.gov.ph/legislative-documents/house-journals)
- For voting, cite the section giving the politician’s actual decision and the precise measure and vote stage. Authors, chamber-wide tallies, and a journal’s attendance roll alone cannot establish a member’s vote. [House legislative process](https://www.congress.gov.ph/legislative-information/legislative-process)
- For committees, cite the official roster, House member page, or journal appointment. Use the term shown by that document and leave appointment dates blank if the source gives only a snapshot. The Senate’s 20th Congress roster identifies Bam Aquino as Basic Education chair in the published roster. That document alone gives no date range for his assignment. [Senate permanent committees](https://legacy.senate.gov.ph/committee/permanent_ctte20th.pdf#page=5) · [House standing committees](https://www.congress.gov.ph/committees/standing)

## Modified files

- Backend API and persistence are in the `LegislativeAccountability`, `LegislativeAccountabilityService` and `LegislativeAccountabilityController` classes in the existing Congress package.
- Database changes are in `db/legislative-migration/V30__add_legislative_accountability.sql` and `application-legislative-accountability.properties`.
- Frontend changes are in `LegislativeAccountabilitySection.jsx` and its stylesheet, `api/legislativeAccountability.js`, the Congress membership hook module, and the desktop and mobile profile pages.
- Validation adds `LegislativeAccountabilityIntegrationTests.java`, the `test:browser:legislative` script, and `ops/politician-coverage/rehearse-legislative-accountability.mjs`.

## Validation results

- Maven `verify` passed with 153 tests passed and three existing opt-in tests skipped. The new tests exercised authorization, draft and published reads, create, edit, withdrawal and restoration, revision conflicts, duplicate entries, source and term validation, filtering, and attendance coverage across pages.
- V30 ran against isolated PostgreSQL 19 through PGlite. The rehearsal covered transaction rollback, evidence constraints, trusted backend access, and denial of direct reads and writes by simulated `anon`, `authenticated` and `service_role` roles. Shared Supabase uses its own PostgreSQL version and effective role grants. Those require separate preflight checks.
- All 72 frontend unit tests passed. Chromium checks passed on desktop and mobile for the new profile views and filters and for the administrator editor. The browser used fixtures. The earlier read-only capture of the 18 Cabinet profiles also passed desktop and mobile regression checks.
- Frontend lint completed with zero errors and 87 warnings. The frontend production build passed with a bundle-size warning. The backend packaged successfully.

## Remaining limitations

Live coverage depends on manually verified entries. There is no seeded or imported legislative accountability history, and published aggregate attendance supplied without session-level records is outside the current calculation. A committee roster can substantiate a role at the time of that roster while leaving appointment and departure dates open. The feature currently accepts official Philippine Congress sources and congressional terms from the 8th Congress onward. No shared migration, data change or deployment was made.
