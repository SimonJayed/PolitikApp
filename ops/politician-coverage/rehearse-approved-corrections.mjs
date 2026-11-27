import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [pglite, snapshot, manifestPath] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(resolve(pglite)).href)
const db = new PGlite()
const read = name => readFileSync(resolve('ops/politician-coverage', name), 'utf8')
const records = readFileSync(snapshot, 'utf8').trim().split(/\r?\n/).map(JSON.parse)
const manifest = readFileSync(manifestPath, 'utf8')
const sql = name => read('approved-corrections-' + name + '.sql')
await db.exec(`
create table politicians(politician_id uuid primary key, full_name varchar(150) unique, position varchar(100),
    jurisdiction text, status text, term_start date, term_end date, biography text, profile_origin text,
    created_at timestamptz, updated_at timestamptz);
create table timeline_entries(timeline_id uuid primary key, politician_id uuid references politicians,
    submission_id uuid, action_identifier text, action_details jsonb, publication_status text, is_hidden boolean,
    source_url text, summary text, verification_notes text, created_at timestamptz, updated_at timestamptz);
create table profile_edit_submissions(submission_id uuid primary key, politician_id uuid references politicians,
    action_identifier text, action_details jsonb, status text, source_url text,
    impact_summary text, verification_notes text, admin_resolution_notes text,
    resolved_at timestamptz, created_at timestamptz, updated_at timestamptz);
create table politician_accomplishments(accomplishment_id uuid primary key, politician_id uuid references politicians,
    title text, description text, category text, accomplishment_date date, accomplishment_year integer,
    visible boolean, source_url text, created_at timestamptz, updated_at timestamptz);
`)
for (const [kind, table] of Object.entries({ PROFILE: 'politicians', TIMELINE: 'timeline_entries', SUBMISSION: 'profile_edit_submissions' })) {
  const data = records.filter(row => row.kind === kind).map(row => row.data)
  await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table}, $1::jsonb)`, [JSON.stringify(data)])
}
// The profile snapshot excluded timestamps. Supply a version for the review fixture.
await db.exec('update politicians set created_at=now() where created_at is null')
const count = async (table, where = 'true') => (await db.query(`select count(*)::int as total from ${table} where ${where}`)).rows[0].total
const stage = async () => {
  await db.exec('begin')
  for (const statement of sql('stage').trim().split(/;\s*\n/).filter(Boolean)) {
    await db.query(statement.replace('?', '$1'), [manifest])
  }
  await db.exec(sql('preflight'))
}
await stage()
await db.exec(sql('apply'))
assert.equal(await count('politicians'), 970)
assert.equal(await count('timeline_entries', 'is_hidden'), 6)
assert.equal(await count('profile_edit_submissions', "status='RESOLVED_DISMISSED'"), 2)
await db.exec('rollback')
assert.equal(await count('politicians'), 952)
assert.equal(await count('timeline_entries', 'is_hidden'), 0)
await stage()
await db.exec(sql('apply'))
await db.exec('commit')
await assert.rejects(stage(), /batch or baseline has changed/)
await db.exec('rollback')
assert.equal(await count('politicians'), 970)
console.log('Correction batch commits and rolls back on isolated PostgreSQL. Repeating the operation fails its baseline guard.')

await db.exec(`
    create role anon;
    create role authenticated;
    create role backend_runtime bypassrls;
    grant usage on schema public to anon, authenticated, backend_runtime;
    grant select on public.politicians to backend_runtime;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, backend_runtime;
`)
await db.exec(readFileSync('backend/src/main/resources/db/citation-migration/V29__add_citation_reviews.sql', 'utf8'))
assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.citation_reviews'::regclass")).rows[0].relrowsecurity, true)
await db.exec('set role backend_runtime')
const profile = 'c9169871-4006-401a-8bf7-51d6a8820fb3'
const reviewer = '00000000-0000-0000-0000-000000000001'
await assert.rejects(db.query(`
    insert into citation_reviews(record_type,record_id,verification_status,record_updated_at,reviewed_at,reviewed_by)
    values('PROFILE',$1,'VERIFIED',now(),now(),$2)
`, [profile, reviewer]), /check constraint/)
await db.query(`
    insert into citation_reviews(record_type,record_id,verification_status,record_updated_at,reviewed_at,reviewed_by)
    select 'PROFILE',politician_id,'PENDING_VERIFICATION',coalesce(updated_at,created_at),now(),$2
    from politicians where politician_id=$1
`, [profile, reviewer])
assert.equal(await count('citation_reviews'), 1)
await db.query(`
    update citation_reviews set verification_status='VERIFIED', source_url='https://example.gov.ph/fixture',
        source_organization='Local fixture', verification_notes='Private test data'
    where record_id=$1
`, [profile])
await db.exec('reset role')
const service = readFileSync('backend/src/main/java/com/politikapp/backend/verification/CitationReviewService.java', 'utf8')
const cte = service.match(/String RECORDS = """([\s\S]+?)""";/)[1]
const publicSql = service.match(/query\(RECORDS \+ """(\s+select record_type, record_id,[\s\S]+?)"""/)[1].replace('?', '$1')
const publicReview = await db.query(cte + publicSql, [profile])
assert.equal(publicReview.rows[0].verification_status, 'VERIFIED')
assert.ok(!('verification_notes' in publicReview.rows[0]))
await db.query("update politicians set updated_at=now() + interval '1 second' where politician_id=$1", [profile])
assert.equal((await db.query(cte + publicSql, [profile])).rows.length, 0)
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`)
  assert.equal(await count('citation_reviews'), 0)
  await assert.rejects(db.query(`
        insert into citation_reviews(record_type,record_id,verification_status,record_updated_at,reviewed_at,reviewed_by)
        values('PROFILE',$1,'UNVERIFIED',now(),now(),$2)
    `, [profile, reviewer]), /row-level security/)
  assert.equal((await db.query("update citation_reviews set verification_notes='Modified'")).affectedRows, 0)
  assert.equal((await db.query('delete from citation_reviews')).affectedRows, 0)
  await db.exec('reset role')
}
assert.equal((await db.query('select verification_notes from citation_reviews')).rows[0].verification_notes, 'Private test data')
console.log((await db.query('select version()')).rows[0].version)
console.log('V29 executed locally. Runtime role can review; anon and authenticated cannot read or mutate; public SQL omits notes and drops stale reviews.')
await db.close()
