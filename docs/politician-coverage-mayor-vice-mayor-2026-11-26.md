# Mayor and vice mayor coverage review

**November 26, 2026 · Applied and verified.** The read-only Supabase preflight matched the position recorded on each profile. It found one Vice Mayor and zero Mayor profiles. The eight President and Vice President profiles remain in scope for the directory. [Named deletion record](data/politician-coverage-mayor-vice-mayor-2026-11-26.json)

| Measure | Total and public profiles |
| --- | ---: |
| Current | 953 |
| Proposed permanent deletions | 1 |
| Retained and expected final count | **952** |

The sole deletion candidate is **Tomas de la Rama Osmeña**, recorded as Vice Mayor and linked to a 15th Congress membership.

The transaction would delete one published project completion timeline entry, including its citation, and detach one BetterGovPH profile link. Its source person revision, one membership relationship, and five bill-authorship relationships would remain. The timeline entry carries a submission ID, and the preflight found zero associated submissions. The leaderboard excludes timeline entries carrying a submission ID from direct scoring. The preflight found zero affected moderation, curation audit, accomplishment, news association, or bookmark rows.

The approved report hash must match `c56a7ace9b51adbfe03a7c3b22f6a6bb0fc7075805fd5e2f4f064ca300a0d55a`. The affected-row backup is in `ops/politician-coverage/backups/mayor-vice-mayor-before-2026-11-26.json` with SHA-256 `a15a4f81e1eea1c307f125749444508f6acead79cf5404f4d3c8131c29345d07`. The transaction writes a fresh backup under lock, checks the final count, and verifies that zero Mayor or Vice Mayor profiles remain. [Operation instructions](../ops/politician-coverage/README.md)

The transaction and rollback passed a disposable PostgreSQL rehearsal. All 13 targeted BetterGovPH population and WGI leaderboard tests passed.

## Live verification

The approved transaction removed Tomas Osmeña’s profile and his one timeline entry. Supabase now has **952 public profiles** and zero profiles recorded as Mayor or Vice Mayor. His BetterGovPH profile link was cleared, and the source person and legislative record counts matched the baseline. Retained profiles, Congress links, timeline entries, and submissions matched their pre-change fingerprints. All 11 article bookmarks were preserved.

The fresh rollback backup is in `ops/politician-coverage/backups/mayor-vice-mayor-approved-apply-2026-11-26.json`. Its SHA-256 matches the preflight backup. The BetterGovPH re-import exclusion is in the local working tree.
