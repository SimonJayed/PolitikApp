import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { combineLeaderboardEntries, formatWgiScore, rankedLeaderboardEntries, validWgiScore } from './wgiLeaderboard.js'

let server
let Entries, Explanation, Leaderboard
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../../../', import.meta.url)), server: { middlewareMode: true, watch: null }, appType: 'custom' })
  ;({ WgiLeaderboardEntries: Entries, Methodology: Explanation, default: Leaderboard } = await server.ssrLoadModule('/src/components/WgiLeaderboard.jsx'))
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
  assert.ok(html.includes('Not ranked') && html.includes('Not yet scored'))
  const refreshed = combineLeaderboardEntries([{ ...people[1], rank: 1, wgiCompositeScore: 20 }, { ...scored, rank: 2 }], people)
  assert.deepEqual(refreshed.map(person => person.politicianId), ['vice', 'senator', 'president', 'old-senator'])
})

test('empty rows never fabricate podium entries', () => {
  const html = renderToStaticMarkup(createElement(Entries, { entries: [] }))
  assert.ok(!html.includes('class="wgiFeatured"'))
  assert.ok(!html.includes('#1'))
})

test('every featured/list score has an explicit label; calculated zero differs from unscored profiles', () => {
  const entries = Array.from({ length: 4 }, (_, index) => ({ politicianId: String(index), fullName: `Member ${index}`, rank: index === 1 ? null : index + 1, wgiCompositeScore: index === 1 ? null : 0 }))
  const html = renderToStaticMarkup(createElement(Entries, { entries }))
  assert.equal((html.match(/<small>WGI Score<\/small>/g) || []).length, 4)
  assert.equal((html.match(/data-score-state="scored"/g) || []).length, 3)
  assert.equal((html.match(/data-score-state="unscored"/g) || []).length, 1)
  assert.ok(html.includes('<strong>0.0</strong>') && html.includes('Not yet scored'))
  assert.ok(html.includes('Not ranked'))
})

test('plain-language explanation uses the real factors and scale without assigning performance grades', () => {
  const html = renderToStaticMarkup(createElement(Leaderboard, { defaultPoliticians: [] }))
  for (const text of ['Worldwide Governance Indicators', 'bill, project, budget and audit records', 'different weights for each office']) assert.ok(!html.includes(text), text)
  for (const text of ['How are scores calculated?', '0–100 scale', 'not an objective judgment']) assert.ok(html.includes(text), text)
  const modal = renderToStaticMarkup(createElement(Explanation, {}))
  for (const text of ['0 to 100', 'lower attainable maximum', 'Commission on Audit', 'not an official World Bank rating', '0.0', 'Not yet scored']) assert.ok(modal.includes(text), text)
  assert.ok(modal.includes('<details class="wgiCalculationDetails">'))
  assert.ok(!modal.includes('<details class="wgiCalculationDetails" open'))
})
