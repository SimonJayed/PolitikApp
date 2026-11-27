# Politician coverage review

**November 26, 2026 · Applied and verified.** The planning counts come from a repeatable-read, read-only transaction on the configured Supabase database. The [full approval report](data/politician-coverage-2026-11-26.json) lists every approved deletion by name, profile UUID, BetterGovPH person ID, and recorded Congresses. It also contains the roster, existing profile matches, Executive exemptions, and dependency counts.

| Measure | Profiles |
| --- | ---: |
| Current Supabase total | 1,175 |
| Current public directory total | 1,173 |
| Eligible for permanent deletion | 174 |
| Existing profiles retained | 1,001 |
| Current Executive officials matched to existing profiles | 16 |
| New Executive profiles | 28 |
| Expected final Supabase total | **1,029** |
| Expected final public directory total | **1,027** |

The deletion rule requires a link to a BetterGovPH person, a membership on the current source revision, and valid Congress numbers below 15 on every recorded membership across revisions. The plan retains 948 profiles with a membership from Congress 15 onward and six profiles with insufficient membership evidence. It also protects 47 profiles whose only recorded memberships predate Congress 15 because they have a recorded executive position, match the current Executive roster, or have separately documented executive service. BetterGovPH records congressional service. Other past executive offices may be missing from the available records.

## Associated records

| Data | Expected effect |
| --- | --- |
| Congress profile links | Detach 174 links from source people to deleted profiles. |
| Congressional history and citations | Keep 174 person revisions, 411 membership relationships, and 10,958 bill-authorship relationships associated with the detached links in the source registry. These counts include all stored revisions. Retained profiles keep their existing links and legislative history. |
| Accountability and moderation | Zero affected timeline entries, edit submissions, queue items, audit events, or accomplishments. Citation fields on these records are unaffected. |
| News and bookmarks | Zero affected politician-to-news associations. Bookmarks reference articles and all article and bookmark rows are preserved. |
| WGI | Zero scoring records belong to deletion candidates. Scores derive from published evidence. New Executive profiles receive an unavailable score until they have qualifying evidence. |

The live catalog showed the restrictive source-link and accomplishment foreign keys, the moderation and news cascades, and the challenge and audit dependencies. Timeline entries and profile submissions use politician UUIDs without direct profile foreign keys. The transaction explicitly handles these associations and blocks on unexpected inbound foreign keys or cross-profile accountability references.

## Executive coverage

The 44-person roster covers the President, Vice President, department heads, and verified Cabinet-level officials. The 16 matches reuse existing profile UUIDs and Congress links. Official appointment announcements and agency directories are linked per official. [Executive roster](../ops/politician-coverage/executive-roster.json) · [Presidential Communications Office appointments](https://pco.gov.ph/news_releases/pbbm-swears-in-10-key-cabinet-officials-presses-stronger-accountability-and-results-for-filipinos/) · [Office of the President directory](https://op-proper.gov.ph/transparency-seal-2/op-officials-directory/) · [Vice President confirmation](https://www.pna.gov.ph/article/senate-skips-questions-on-ovps-p7852-m-2027-budget)

## Approval and recovery

The scope is fixed by SHA-256 `39e5d770a189cc9beb767fa9df62f6cbd304c291abcdf9bbfa483af2629c8fde`. The affected-row backup is in the ignored local directory `ops/politician-coverage/backups/before-2026-11-26.json`. Its SHA-256 is `e14c99c94d476cdcf69cd2e962613e4094651b64dcfe5ab3eef361e38ece0529`. It includes the full rows scheduled for deletion or update and the IDs planned for insertion.

The transaction locks the affected tables, recomputes the report, and aborts on drift. It writes a fresh backup before changing rows and commits only after checking the resulting profile count, Executive roster, and detached dependencies. Any transaction failure rolls back the changes. The operational runner and recovery details are in the [coverage instructions](../ops/politician-coverage/README.md).

## Validation completed before approval

- The report and backup contain matching deletion IDs and profile counts.
- The transaction passed a disposable PostgreSQL rehearsal with affected submissions, challenge records, moderation audits, news associations, bookmarks, and legislative relationships. The rehearsal exercised rollback and verified the retained rows.
- The frontend production build, 71 frontend tests, and 22 targeted backend tests passed. Local browser fixtures exercised both directory layouts, search, pagination, profile navigation, and WGI ranking.

## Live verification after approval

The approved transaction removed 174 profiles, added 28 Executive profiles, and reused 16. The read-only check confirmed **1,029 total profiles**, **1,027 public profiles**, and **44 active officials** matching the Executive roster. All 174 BetterGovPH source people survived with their profile links cleared. All 997 retained source links passed a before-and-after fingerprint check. The source entity, revision, and relationship counts matched their baseline.

The timeline and submission fingerprints matched the pre-change snapshot. All 11 article bookmarks were preserved, the existing Executive scoring inputs matched, and the new officials had zero eligible scoring records. The transaction's fresh backup is at `ops/politician-coverage/backups/approved-apply-2026-11-26.json`. Its SHA-256 matches the preflight backup above. The application changes are in the local working tree.
