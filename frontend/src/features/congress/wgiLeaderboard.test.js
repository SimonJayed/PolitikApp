import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { combineLeaderboardEntries, formatWgiScore, rankedLeaderboardEntries, validWgiScore } from './wgiLeaderboard.js'

let server
let Entries
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../../../', import.meta.url)), server: { middlewareMode: true, watch: null }, appType: 'custom' })
  ;({ WgiLeaderboardEntries: Entries } = await server.ssrLoadModule('/src/components/WgiLeaderboard.jsx'))
})
after(async () => { await server?.close() })

test('missing, invalid, and out-of-range scores remain Not Available; valid zero is preserved', () => {
  for (const input of [null, undefined, '', ' ', false, true, NaN, Infinity, -1, 101, 'not a score']) {
    assert.equal(validWgiScore(input), null)
    assert.equal(formatWgiScore(input), 'Not Available')
  }
  assert.equal(validWgiScore(0), 0)
  assert.equal(formatWgiScore(0), '0.0')
  assert.equal(formatWgiScore('87.25'), '87.3')
})

test('invalid/missing scores or ranks never receive a displayed numerical ranking', () => {
  const entry = { politicianId: 'one', rank: 1, wgiCompositeScore: 0 }
  assert.deepEqual(rankedLeaderboardEntries([entry, { ...entry, politicianId: 'null', wgiCompositeScore: null },
    { ...entry, rank: null }, { ...entry, wgiCompositeScore: Infinity }]), [entry])
})

test('only the top three are featured; remaining entries retain server ranks and profile navigation buttons', () => {
  const rows = Array.from({ length: 6 }, (_, index) => ({ politicianId: String(index), rank: index + 1, fullName: `Member ${index}`, position: 'SENATOR', wgiCompositeScore: 60 - index, profileImageUrl: `https://example.com/${index}.jpg` }))
  const html = renderToStaticMarkup(createElement(Entries, { entries: rows }))
  assert.equal((html.match(/class="wgiFeatured"/g) || []).length, 3)
  assert.equal((html.match(/class="wgiListRow"/g) || []).length, 3)
  assert.ok(html.includes('Rank 1') && html.includes('#6'))
  assert.ok(html.includes('View profile: Member 0'))
  assert.ok(html.includes('https://example.com/0.jpg'))
  assert.ok(html.indexOf('Member 0') < html.indexOf('Member 5'))
})

test('scored profiles lead, followed by default directory order without duplicate profiles or invented zeros', () => {
  const people = ['president', 'vice', 'senator', 'old-senator'].map(politicianId => ({ politicianId, fullName: politicianId, wgiCompositeScore: 0 }))
  const scored = { ...people[2], rank: 1, wgiCompositeScore: 12 }
  const combined = combineLeaderboardEntries([scored], people)
  assert.deepEqual(combined.map(person => person.politicianId), ['senator', 'president', 'vice', 'old-senator'])
  assert.equal(combined[0].wgiCompositeScore, 12)
  assert.ok(combined.slice(1).every(person => person.rank === null && person.wgiCompositeScore === null))
  const html = renderToStaticMarkup(createElement(Entries, { entries: combined }))
  assert.ok(html.includes('Position 2') && html.includes('WGI score not available'))
  const refreshed = combineLeaderboardEntries([{ ...people[1], rank: 1, wgiCompositeScore: 20 }, { ...scored, rank: 2 }], people)
  assert.deepEqual(refreshed.map(person => person.politicianId), ['vice', 'senator', 'president', 'old-senator'])
})

test('empty rows never fabricate podium entries', () => {
  const html = renderToStaticMarkup(createElement(Entries, { entries: [] }))
  assert.ok(!html.includes('class="wgiFeatured"'))
  assert.ok(!html.includes('#1'))
})
