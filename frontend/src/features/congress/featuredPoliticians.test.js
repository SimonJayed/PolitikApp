import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectFeaturedPoliticians } from './featuredPoliticians.js'

const today = '2026-11-12'
const senator = id => ({ politicianId: id, fullName: `Senator ${id}`, position: 'SENATOR', status: 'ACTIVE', termStart: '2025-06-30', termEnd: '2031-06-30' })

test('indicator profiles come first and current senators fill the remaining six slots without duplicates', () => {
  const people = [{ politicianId: 'mayor', fullName: 'Mayor', coaAuditDiscrepancies: 1 },
    { ...senator('b'), billsAuthored: 2 }, ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(senator)]
  const result = selectFeaturedPoliticians(people, today)
  assert.equal(result.length, 6)
  assert.deepEqual(result.map(person => person.politicianId), ['mayor', 'b', 'a', 'c', 'd', 'e'])
  assert.equal(new Set(result.map(person => person.politicianId)).size, 6)
})

test('six current senators are selected when no indicator data exists; former and future terms are excluded', () => {
  const people = [{ ...senator('old'), termEnd: '2025-06-30' },
    { ...senator('future'), termStart: '2028-06-30' }, { ...senator('inactive'), status: 'INACTIVE' },
    ...['g', 'f', 'e', 'd', 'c', 'b', 'a'].map(senator)]
  assert.deepEqual(selectFeaturedPoliticians(people, today).map(person => person.politicianId), ['a', 'b', 'c', 'd', 'e', 'f'])
})

test('six indicator profiles take priority over fallback senators and archived profiles are excluded', () => {
  const people = [{ politicianId: 'archived', wgiCompositeScore: 99, status: 'ARCHIVED' },
    ...Array.from({ length: 7 }, (_, id) => ({ politicianId: String(id), wgiCompositeScore: id === 0 ? -1 : 1 })), senator('a')]
  assert.deepEqual(selectFeaturedPoliticians(people, today).map(person => person.politicianId), ['0', '1', '2', '3', '4', '5'])
})
