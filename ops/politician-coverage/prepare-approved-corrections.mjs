import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { secretaries } from './approved-secretaries.mjs'
import { corrections } from './approved-accountability.mjs'

const [snapshot, output] = process.argv.slice(2)
if (!snapshot || !output) throw new Error('Pass an audit preflight JSONL and a new manifest path.')
const rows = readFileSync(snapshot, 'utf8').trim().split(/\r?\n/).map(JSON.parse)
const byKind = kind => rows.filter(row => row.kind === kind).map(row => row.data)
const people = byKind('PROFILE')
const timelines = byKind('TIMELINE')
const submissions = new Map(byKind('SUBMISSION').map(row => [row.submission_id, row]))
assert.equal(people.length, 952)
assert.equal(secretaries.length, 18)

const normalize = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/"[^"]*"/g, '').replace(/[^a-z]+/g, ' ').trim()
const official = raw => {
  const target = new URL(raw)
  assert.equal(target.protocol, 'https:')
  assert.match(target.hostname, /(?:^|\.)gov\.ph$/)
  assert.ok(!target.username && !target.password)
}
const profiles = secretaries.map(person => {
  const { position, name, aliases, corroboration, source, start, evidence, department, date } = person
  official(source)
  if (corroboration) official(corroboration)
  const names = [name, ...aliases].map(normalize)
  const words = normalize(name).split(' ').filter(word => !['jr', 'sr', 'ma'].includes(word) && word.length > 1)
  const peopleMatches = people.filter(row => {
    const existing = normalize(row.full_name)
    const tokens = existing.split(' ')
    return names.includes(existing) || (tokens.includes(words[0]) && tokens.includes(words.at(-1)))
      || (row.position === position && row.status === 'ACTIVE')
  })
  assert.equal(peopleMatches.length, 0, `Existing identity or active office for ${name}`)
  const hash = createHash('sha256').update('PolitikApp:Cabinet:2026-11-27:' + position).digest('hex')
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  const biography = `Secretary of the Department of ${department}. ${evidence}\n\nOfficial sources: ${[source, corroboration].filter(Boolean).join(' ')}`
  return { id, name, position, start, date, names, biography, source, corroboration }
})

const changes = corrections.map(({ prefix, operation, note, source, summary, details }) => {
  official(source)
  const matches = timelines.filter(row => row.timeline_id.startsWith(prefix))
  assert.equal(matches.length, 1, prefix)
  const timeline = matches[0]
  const submission = submissions.get(timeline.submission_id)
  assert.equal(timeline.publication_status, 'PUBLISHED')
  assert.equal(timeline.is_hidden, false)
  assert.ok(!timeline.action_details?.sourceReported && !timeline.action_details?.openCongressId && !timeline.action_details?.sourceKey)
  if (submission) {
    assert.equal(submission.politician_id, timeline.politician_id)
    assert.equal(submission.status, 'PUBLISHED')
    assert.equal(submission.submitting_account?.role, 'ADMIN')
    assert.equal(timelines.filter(row => row.submission_id === submission.submission_id).length, 1)
  }
  const org = new URL(source).hostname.includes('senate.gov.ph') ? 'Senate of the Philippines'
    : new URL(source).hostname.includes('dbm.gov.ph') ? 'Department of Budget and Management'
    : 'Philippine Information Agency, citing the National Irrigation Administration'
  return { operation, note: note + ' Evidence: ' + source, source, summary,
    details: operation === 'edit' ? { ...details, sourceOrganization: org } : {},
    timeline, submission: submission ?? null }
})

writeFileSync(output, JSON.stringify({ profiles, changes }, null, 2) + '\n', { flag: 'wx' })
console.log(`${profiles.length} profile inserts, ${changes.length} timeline changes, ${changes.filter(change => change.submission).length} linked submission changes`)
