# Politician coverage operation

Run from the repository root with Java and the PostgreSQL JDBC driver. The runner reads the target connection from the local `backend/.env`. Review the target before any write. [Approval report](../../docs/politician-coverage-review-2026-11-26.md)

To generate a new read-only report and affected-row backup, use unused output paths.

```powershell
$coverageJdbc = Get-ChildItem (Join-Path $env:USERPROFILE '.m2/repository/org/postgresql/postgresql') -Filter 'postgresql-*.jar' -Recurse |
    Sort-Object Name -Descending | Select-Object -First 1
New-Item -ItemType Directory -Force ops/politician-coverage/backups | Out-Null
java -cp $coverageJdbc.FullName ops/politician-coverage/PoliticianCoverage.java report ops/politician-coverage/backups/review.json ops/politician-coverage/backups/review-backup.json
```

After explicit approval of the report, use the `apply` mode with that report's lowercase SHA-256 and a new backup path. Keep the pre-coverage Congress population job disabled through the operation until the updated population code is available. The application changes and deployment are separate from this SQL operation.

```powershell
java -cp $coverageJdbc.FullName ops/politician-coverage/PoliticianCoverage.java apply '<approved-report-sha256>' ops/politician-coverage/backups/apply-backup.json
```

The backup captures the rows as they existed before the transaction and lists the new Executive UUIDs. Keep the backup private. Rehearse any restoration in a scratch database first. For a targeted restore after a successful commit, reconcile later edits and dependencies first. Reinsert deleted politicians before relinking their Congress records. Restore timeline rows before submissions that challenge them, then restore moderation rows and curation events. Restore accomplishments and news associations once their parents exist. Restore changed Executive fields from their archived originals and review dependencies before removing newly inserted Executive profiles. PostgreSQL `jsonb_populate_recordset` can load each row array into its original table type.

After an approved run, verify the live counts against the original report, check both branch filters and the last directory page, and open a retained profile that has both early and recent Congress memberships. Verify ranked entries and the unranked profile count against the leaderboard API.

## Congress-only coverage

Append `--congress-only` to both the `report` and `apply` commands when using the [Congress-only report](../../docs/politician-coverage-congress-only-2026-11-26.md). This mode requires documented congressional membership starting with Congress 15, applies to every profile, and leaves the Executive roster seeding step empty. Use the Congress-only report's approved digest for an apply run.

Append `--mayors-only` to both commands for the [Mayor and Vice Mayor review](../../docs/politician-coverage-mayor-vice-mayor-2026-11-26.md). This mode selects Mayor and Vice Mayor positions recorded on profiles, including city and municipal variants. Use the corresponding approved digest.
