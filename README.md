# PolitikApp

## Git Workflow Guidelines

This project follows simple Git conventions to keep history clean and collaboration easy. Please follow these guidelines when creating branches, writing commits, and opening pull requests.

Branch naming conventions:

- **Features**: `feature/<short-description>` (e.g., `feature/user-authentication`)
- **Bug fixes**: `fix/<short-description>` (e.g., `fix/login-validation`)
- **Documentation**: `docs/<short-description>` (e.g., `docs/update-readme`)
- **Chores/Maintenance**: `chore/<short-description>` (e.g., `chore/update-dependencies`)
- **Refactoring**: `refactor/<short-description>` (e.g., `refactor/cleanup-models`)
- **Tests**: `test/<short-description>` (e.g., `test/user-model`)
- **Style**: `style/<short-description>` (e.g., `style/format-templates`)

Use these branch prefixes to keep the repository organized and make the purpose of each branch clear.

Commit messages (Conventional Commits):

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

Examples:

```
feat: add user registration form
fix: resolve login redirect issue
docs: update installation instructions
chore: update dependencies
```

## Open Congress dataset import (admin only)

The Spring backend reads [BetterGovPH's dataset](https://github.com/bettergovph/open-congress-data)
directly from a local Git clone; the hosted Open Congress API, Neo4j and Deno are not used.
Inspected snapshot: `6e853ee027790427c5b5961c6318ff907cf717d5`. The adapter reads
`data/person/*.toml`, `data/congress/*.toml`, `data/group/chamber/*.toml`,
`data/committee/*.toml`, and `data/document/{hb,sb}/{congress}/*.toml`.
Bill metadata is under `[meta]`; `[[history]]`, `[[status]]`, and person `[[memberships]]`
are retained. Author codes resolve through `data/person/.{senate,house}-website-key-mapping.yml`;
Senate mappings may be Congress-specific. Raw coauthor names are not guessed into identities.

Read-only verification on October 29, 2026 confirmed V11/V23 marked DELETED,
V24/V25 successful, all checksums valid and the three Congress tables present in the
configured Supabase database. V25 is now in `backend/src/main/resources/db/migration/`.
Congress 20 from commit `6e853ee027790427c5b5961c6318ff907cf717d5` was imported
after a clean database-aware preview: 7,446 records, including 6,034 bills and 1,173
people. Imported identities are unlinked until an admin verifies and links them.
Do not repair or reapply it. Other database copies still require their own preflight.
For a database where V25 has not been applied, keep its SQL in `db/pending/` until
separate migration approval; an unapproved migration must not be active on restart.
Use `./backend/scripts/migrate-open-congress.ps1` from the repository root for a read-only
Flyway 11.7.2 preflight. It also accepts an already-applied V25 after validation and
schema checks, without writing anything. Use `-MavenRepository <path>` when the local
Maven cache belongs to a different account. For an unapplied V25 only, after separate approval, execute
`./backend/scripts/migrate-open-congress.ps1 -Apply`. It validates existing checksums,
requires V11/V23 DELETED, V24 successful and only V25 pending, and targets V25 using both
active and pending locations. It never repairs history. After successful execution it moves
V25 into `db/migration` so subsequent backend validation resolves the applied migration.
If that local move fails, stop and inspect before restarting. Do not execute SQL manually.

Clone the dataset outside this repository and make Git available on the backend's PATH:

```powershell
git clone https://github.com/bettergovph/open-congress-data.git C:/Users/edz/datasets/open-congress-data
git -C C:/Users/edz/datasets/open-congress-data rev-parse HEAD
```

Set `OPEN_CONGRESS_CHECKOUT` to that absolute path and `OPEN_CONGRESS_ENABLED=true` in
the backend environment. Keep `OPEN_CONGRESS_IMPORT_ENABLED=false` until migration and
import approval. The runtime Docker image includes Git; deployments also need a read-only
mount of the clone and the corresponding container path.
For Docker Compose, set `OPEN_CONGRESS_HOST_CHECKOUT` to the host clone path and use
`docker compose -f docker-compose.yml -f docker-compose.congress.yml up --build`.
The override mounts the dataset read-only and sets the backend's container path.
No import runs on startup or on a schedule. Files are read from the requested full commit SHA,
not the working tree. Updating the clone/fetching newer commits is an operator action.

In the frontend, sign in as an administrator and open **Congress Data**. The **Review** tab
checks the configured local snapshot against imported records on opening and shows exact-name
politician match suggestions and counts of new or changed source records. A name match is only
a suggestion: compare office, jurisdiction, membership and primary references, then confirm
the link from Review or the politician's admin profile. Linked source records appear on that
profile for admins without altering curated profile fields or publishing claims. **Browse records**
searches imported people and bills. **Dataset tools** holds commit, Congress scope, previews and
imports. A fresh preview is required after changing update approval. The check reads only the
local clone; fetching a newer dataset commit remains an operator action. Preview works before V25;
it reports source counts without claiming to compare against database records. Previews
are held in memory until replaced or the backend restarts. After an approved V25 migration,
set `OPEN_CONGRESS_IMPORT_ENABLED=true`, restart, rerun the preview and explicitly confirm
**Import reviewed dataset**. Existing changed records require the separate updates checkbox.
Imported records remain admin-only. Link verified identities to existing politicians to
show the same source information on their profile in admin view. Create missing verified
politician profiles through the existing Politicians page; do not invent required dates.

With an administrator bearer token, send `POST /api/admin/open-congress/imports`:

```json
{"commit":"6e853ee027790427c5b5961c6318ff907cf717d5","dryRun":true,"allowUpdates":false,"congress":20}
```

Poll `GET /api/admin/open-congress/imports/{id}` using the returned job ID. The Congress
filter limits bills; supporting profiles, chambers, congresses and committees are still read.
Omit it to import all bills. Preview is the default and writes no records. After review,
explicitly use `dryRun:false` and `previewJobId` set to the completed preview's ID to
insert records. The backend requires a successful database-aware preview with the exact
same commit, Congress and `allowUpdates` values. A restart or replacement job requires
a fresh preview. Existing changed records require
`allowUpdates:true`; this advances their imported revision while retaining old revisions.
Curated politician fields and timelines are never overwritten. Unchanged fingerprints are
skipped; failed files can be retried. Removed upstream files are retained, not deleted.
Jobs run in the background, with counts and up to 100 per-file issues. Status is in memory
until the next job/restart; completed records persist and reruns resume by fingerprint.

Review via `GET /api/admin/open-congress/records?kind=PERSON&limit=50&offset=0`
(also BILL, CONGRESS, CHAMBER, COMMITTEE), `/records/{id}`, and `/records/{id}/revisions`.
Details include raw status/history, uncertainty flags, source URLs, Git provenance,
mapping provenance, and timestamps. `snapshot_updated_at` is the commit timestamp,
not a claim about when the original government source changed; missing source dates stay unknown.

Explicit review actions reuse existing entities:

- `POST /people/{id}/link` with `{"politicianId":"<existing UUID>"}` links an existing profile.
- `POST /people/{id}/politician` accepts the existing CreatePoliticianRequest fields, including
  admin-verified personal term dates, office and jurisdiction. It refuses duplicate names and
  returns the same linked profile on repeat requests. Congress dates are not personal term dates.
- `POST /bills/{id}/timeline-draft` with `{"personId":"<source ID>"}` creates one idempotent
  DRAFT TimelineEntry for a resolved author linked to a politician; a primary source URL is required.
  It never publishes or overwrites a timeline. Review through the existing curation workflow.

All these paths use the `/api/admin/open-congress` prefix. Imported legislative records never
become news articles automatically. Filing does not establish enactment; reported statuses and
history remain source claims pending primary-source review. The initial Congress 20 import
was completed on October 29, 2026; no legislative record was automatically published.

## Government news retrieval

In Admin → News Review, select **Fetch Latest News** to discover recent articles. The first
fetch creates approved source records for DOST's RSS feed and the Department of Agriculture's
news listing. It also upgrades the inactive DOST source left by the one-article prototype.
The button writes newly discovered articles to News Review as `PENDING_REVIEW`; it does not
publish them. Review the extracted text and original URL, edit the draft if needed, then
select **Approve** and **Publish** separately. Published articles appear in the public News
feed. The source list shows retrieval errors and lets an administrator pause a source.

Discovery checks at most 20 recent links per source, skips feed items older than 60 days,
and skips stored canonical URLs. DOST uses RSS; DA uses its HTML news listing because its
RSS endpoint currently returns a homepage. Source pages are fetched only from explicitly
approved HTTPS hosts. Other active sources can still be configured in the existing source
manager. Scheduling remains disabled (`NEWS_SCHEDULED_ENABLED=false`), and retrieval uses
deterministic review excerpts without Gemini. The manual fetch is a database-writing action;
read-only live checks use `GovernmentNewsDiscoveryLiveTests`.
