# Congress-only coverage report

**November 26, 2026 · Applied and verified.** The read-only Supabase preflight applied the stricter rule to the database after the earlier cleanup. A profile qualifies if its BetterGovPH record documents at least one membership in the 15th Congress or later. The rule applies to Executive officials and profiles with incomplete membership evidence. The [named deletion list](data/politician-coverage-congress-only-2026-11-26.json) records each profile name, UUID, Congress evidence, position, and eligibility reason.

| Measure | Total | Public |
| --- | ---: | ---: |
| Current profiles | 1,029 | 1,027 |
| Proposed permanent deletions | 81 | 79 |
| Retained profiles and expected final count | **948** | **948** |

Among the 81 candidates, 47 have only pre-15th Congress memberships and 34 lack qualifying membership evidence. The candidates include 31 officials from the 44-person Executive roster, including Vice President Sara Duterte. Thirteen roster members qualify through prior congressional service, including President Ferdinand Marcos Jr. The remaining profiles include past and sitting members of Congress.

## Associated records

| Data | Expected effect |
| --- | --- |
| Timeline entries | Delete eight entries belonging to the archived Mock Politician profile. Those entries are outside the public WGI rankings. |
| Congress links and source history | Detach 49 profile links. Preserve the corresponding 49 person revisions, 120 membership relationships, and 3,028 bill-authorship relationships, along with the full source history of retained profiles. |
| Submissions, moderation, accomplishments, and news | Zero affected submissions, moderation queue rows, curation audits, accomplishments, or news associations. Article bookmarks stay linked to their articles. |

The report found no dependency blockers. The locked transaction checks the approved report hash, creates a fresh backup, and confirms that every remaining profile has qualifying membership before committing. The local backup is in `ops/politician-coverage/backups/congress-only-before-2026-11-26.json`. Its SHA-256 is `7d0ec7f339bfdf49eb44620d34d676a01301694c4e47726a7b0946b0cf305c23`. The report SHA-256 is `6f906d1eccd31ee334fdaa33f04c3966738740f02b56798da37220166cc32a4a`. [Operation instructions](../ops/politician-coverage/README.md)

The transaction and rollback passed a disposable PostgreSQL rehearsal. All 13 targeted import, directory, and leaderboard tests passed.

## Live verification

The approved transaction deleted all 81 listed profiles and eight timeline entries. Supabase now contains 948 profiles, all public and each with at least one recorded membership in the 15th Congress or later. The retained profiles, Congress links, timeline records, and submissions matched their pre-change fingerprints. The congressional source record counts and all 11 article bookmarks also matched their baseline.

The fresh transaction backup is at `ops/politician-coverage/backups/congress-only-approved-apply-2026-11-26.json`. Its SHA-256 matches the preflight backup. The stricter BetterGovPH import guard is in the local working tree.

## Subsequent presidential coverage update

Supabase now includes the eight Presidents and Vice Presidents whose terms overlap 2010 or later. The update restored Benigno Aquino III, Noli de Castro, and Sara Duterte with their original profile IDs, added Rodrigo Duterte and Jejomar Binay, and reused Gloria Macapagal-Arroyo, Leni Robredo, and Ferdinand Marcos Jr. Aquino and de Castro recovered their earlier congressional links. The verified public profile count after the update is **953**. [Government historical summary](https://www.pna.gov.ph/opinion/pieces/569-pbbm-vpszdu30-team-a-nice-choice-by-filipino-voters) · [Official 2016 assumption of office](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/27/63735) · [Current Vice President](https://www.pna.gov.ph/article/senate-skips-questions-on-ovps-p7852-m-2027-budget)
