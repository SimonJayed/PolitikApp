import assert from 'node:assert/strict'
import { test } from 'node:test'
import { congressOptions, directoryJurisdiction, directoryRank, matchesCongress, matchesPosition, normalizePosition, sortDirectory } from './politicianDirectory.js'

const today = '2026-11-12'
const person = (id, position = null, extra = {}) => ({ politicianId: id, fullName: id, position, status: 'ACTIVE', ...extra })
const term = { termStart: '2025-01-01', termEnd: '2028-01-01' }
const metadata = new Map([
  ['s-z', { lastName: 'Zulu', firstName: 'Ana', memberships: [{ chamber: 'senate', congress: 20 }, { chamber: 'house', congress: 19 }] }],
  ['s-a', { lastName: 'Abad', firstName: 'Zena', memberships: [{ chamber: 'senate', congress: 20 }] }],
  ['h-z', { lastName: 'Zulu', memberships: [{ chamber: 'house', congress: 20 }, { chamber: 'senate', congress: 19 }] }],
  ['h-a', { lastName: 'Abad', memberships: [{ chamber: 'house', congress: 20 }] }],
  ['old-s', { memberships: [{ chamber: 'senate', congress: 8 }] }],
  ['old-h', { memberships: [{ chamber: 'house', congress: 19 }] }],
])

test('default order prioritizes current offices, alphabetizes chamber members by surname, and puts former legislators last', () => {
  const people = [person('old-h'), person('h-z'), person('s-z'), person('vice', 'VICE_PRESIDENT', term),
    person('old-s'), person('h-a'), person('president', 'President', term), person('s-a'), person('mayor', 'MAYOR', term)]
  assert.deepEqual(sortDirectory(people, metadata, 20, today).map(p => p.politicianId),
    ['president', 'vice', 's-a', 's-z', 'h-a', 'h-z', 'mayor', 'old-s', 'old-h'])
  assert.equal(people[0].politicianId, 'old-h', 'the caller array is not mutated')
})

test('Senate and House filters include source-only profiles and people who served in both chambers', () => {
  assert.equal(matchesPosition(person('s-z'), 'SENATOR', metadata), true)
  assert.equal(matchesPosition(person('h-z'), 'HOUSE_REPRESENTATIVE', metadata), true)
  assert.equal(matchesPosition(person('h-z'), 'SENATOR', metadata), true)
  assert.equal(matchesPosition(person('old-h'), 'SENATOR', metadata), false)
  assert.equal(matchesPosition(person('manual', 'House Representative'), 'HOUSE_REPRESENTATIVE', metadata), true)
})

test('Congress selection matches chamber and Congress together without leaking the other chamber', () => {
  assert.equal(matchesCongress(person('s-z'), 'SENATOR', '20', metadata), true)
  assert.equal(matchesCongress(person('s-z'), 'SENATOR', '19', metadata), false)
  assert.equal(matchesCongress(person('s-z'), 'HOUSE_REPRESENTATIVE', '19', metadata), true)
  assert.equal(matchesCongress(person('manual', 'SENATOR'), 'SENATOR', '20', metadata), false)
  assert.equal(matchesCongress(person('manual'), 'SENATOR', 'ALL', metadata), true)
})

test('Congress choices contain only the selected chamber memberships, descending, with no archived-only options', () => {
  const people = [...metadata.keys()].map(id => person(id))
  assert.deepEqual(congressOptions(people, 'SENATOR', metadata), [20, 19, 8])
  assert.deepEqual(congressOptions(people, 'HOUSE_REPRESENTATIVE', metadata), [20, 19])
  assert.deepEqual(congressOptions(people, 'MAYOR', metadata), [])
  assert.deepEqual(congressOptions([person('old-s', null, { status: 'ARCHIVED' })], 'SENATOR', metadata), [])
})

test('expired, inactive, and future terms do not qualify as current offices', () => {
  assert.equal(directoryRank(person('expired', 'PRESIDENT', { termStart: '2016-01-01', termEnd: '2022-01-01' }), metadata, 20, today), 9)
  assert.equal(directoryRank(person('s-z', 'Senator', { status: 'INACTIVE' }), metadata, 20, today), 10)
  assert.equal(directoryRank(person('s-z', 'Senator', { termStart: '2019-01-01', termEnd: '2025-01-01' }), metadata, 20, today), 10)
  assert.equal(directoryRank(person('future', 'VICE_PRESIDENT', { termStart: '2028-01-01', termEnd: '2034-01-01' }), metadata, 20, today), 9)
  assert.equal(directoryRank(person('s-z'), metadata, null, today), 10)
})

test('an explicitly current office takes priority over historical or conflicting dataset memberships', () => {
  assert.equal(directoryRank(person('h-z', 'HOUSE_REPRESENTATIVE', term), metadata, 20, today), 3)
  assert.equal(directoryRank(person('s-z', 'MAYOR', term), metadata, 20, today), 6)
  assert.equal(directoryRank(person('s-z', 'PRESIDENT', term), metadata, 20, today), 0)
})

test('position normalization combines case and human-readable aliases', () => {
  assert.equal(normalizePosition('Vice President'), 'VICE_PRESIDENT')
  assert.equal(normalizePosition('House of Representatives'), 'HOUSE_REPRESENTATIVE')
  assert.equal(normalizePosition('Senate'), 'SENATOR')
})

test('source-only chamber members remain included under National jurisdiction without overriding a curated jurisdiction', () => {
  assert.equal(directoryJurisdiction(person('h-a'), metadata), 'NATIONAL')
  assert.equal(directoryJurisdiction(person('s-z', 'MAYOR', { jurisdiction: 'CEBU_CITY' }), metadata), 'CEBU_CITY')
  assert.equal(directoryJurisdiction(person('unknown'), metadata), null)
})
