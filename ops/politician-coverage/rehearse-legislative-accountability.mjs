import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const packageEntry = process.argv[2]
if (!packageEntry) throw new Error('Pass the local PGlite package entry as the first argument.')
const { PGlite } = await import(pathToFileURL(resolve(packageEntry)).href)
const migration = await readFile('backend/src/main/resources/db/legislative-migration/V30__add_legislative_accountability.sql', 'utf8')
const db = new PGlite()
const politician = '00000000-0000-0000-0000-000000000001'
const reviewer = '00000000-0000-0000-0000-000000000002'
const record = '00000000-0000-0000-0000-000000000003'
try {
  await db.exec(`
    create table public.politicians (politician_id uuid primary key);
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create role backend_runtime bypassrls;
    grant usage on schema public to anon, authenticated, service_role, backend_runtime;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to anon, authenticated, service_role, backend_runtime;
    insert into public.politicians values ('${politician}');
  `)
  await db.exec('begin')
  await db.exec(migration)
  await db.exec('rollback')
  assert.equal((await db.query("select to_regclass('public.legislative_accountability') as relation")).rows[0].relation, null)
  await db.exec(migration)
  const result = await db.query("select relrowsecurity from pg_class where oid='public.legislative_accountability'::regclass")
  assert.equal(result.rows[0].relrowsecurity, true)
  await db.exec('set role backend_runtime')
  const insert = `
    insert into public.legislative_accountability
      (record_id, politician_id, congress, chamber, kind, decision, title, reference, event_date,
        record_key, verification_status, source_url, verification_notes, reviewed_at, reviewed_by)
    values ($1, $2, 20, 'SENATE', 'VOTE', 'ABSTAINED', 'Test measure', 'Test vote reference',
        '2025-08-01', 'test-vote', 'VERIFIED', $4, 'Isolated fixture', current_timestamp, $3)
  `
  await assert.rejects(db.query(insert, [record, politician, reviewer, null]), { code: '23514' })
  await db.query(insert, [record, politician, reviewer, 'https://legacy.senate.gov.ph/lisdata/fixture.pdf'])
  assert.equal((await db.query('select decision from public.legislative_accountability')).rows[0].decision, 'ABSTAINED')
  await db.exec('reset role')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`set role ${role}`)
    for (const command of [
      'select * from public.legislative_accountability',
      'update public.legislative_accountability set decision = current_user',
      'delete from public.legislative_accountability',
    ]) {
      await assert.rejects(db.query(command), { code: '42501' })
    }
    await assert.rejects(db.query(insert, [record, politician, reviewer, null]), { code: '42501' })
    await db.exec('reset role')
  }
  console.log((await db.query('select version()')).rows[0].version)
  console.log('V30 passed transactional rollback, evidence constraints, backend access and direct API role denial.')
} finally {
  await db.close()
}
