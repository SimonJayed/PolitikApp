import test from 'node:test'
import assert from 'node:assert/strict'
import { congressLabel, groupBillsByCongress, membershipSummary, ordinal, summarizeMemberships } from './congressHistory.js'
import { formatDisplayName } from './displayName.js'

test('shows both chambers, deduplicates memberships and sorts Congress numbers numerically', () => {
  assert.deepEqual(summarizeMemberships([
    { chamber: 'senate', congress: '20' }, { chamber: 'senate', congress: '8' },
    { chamber: 'senate', congress: '10' }, { chamber: 'senate', congress: '8' },
    { chamber: 'house', congress: '13' },
  ]), ['Senate: 8th, 10th, and 20th Congresses', 'House of Representatives: 13th Congress'])
})

test('missing congressional history does not invent a chamber, office or term', () => {
  assert.deepEqual(summarizeMemberships(), [])
  assert.deepEqual(summarizeMemberships([{ chamber: 'house', congress: null }]), ['House of Representatives: Congress number unavailable'])
})

test('formats ordinal Congress numbers, deduplicates and handles singular and plural labels', () => {
  assert.deepEqual([1, 2, 3, 11, 12, 13, 20, 21].map(ordinal), ['1st', '2nd', '3rd', '11th', '12th', '13th', '20th', '21st'])
  assert.equal(congressLabel([14, '14']), '14th Congress')
  assert.equal(congressLabel([13, 11, 12]), '11th, 12th, and 13th Congresses')
  assert.equal(congressLabel([11, 12]), '11th and 12th Congresses')
  assert.equal(congressLabel([null, '', 'Unknown', -1]), '')
})

test('membership classification uses only memberships, including both chambers and incomplete data', () => {
  assert.deepEqual(membershipSummary(), { chamber: null, congresses: '' })
  assert.deepEqual(membershipSummary([{ chamber: 'house', congress: 12 }, { chamber: 'senate', congress: 14 }]), {
    chamber: 'Both', congresses: '12th and 14th Congresses',
  })
  assert.deepEqual(membershipSummary([{ chamber: 'unknown', congress: 12 }]), { chamber: null, congresses: '12th Congress' })
})

test('bill grouping preserves every bill, source reference, chamber and relationship without inferring membership', () => {
  const records = [
    { key: 'a', type: 'BILL', congress: 9, chamber: 'house', relationship: 'AUTHORED_BY', sourceUrl: 'https://example.gov.ph/a' },
    { key: 'b', type: 'BILL', congress: 20, chamber: 'senate', relationship: 'CO_AUTHORED_BY' },
    { key: 'c', type: 'BILL', congress: null },
    { key: 'm', type: 'MEMBERSHIP', congress: 14 },
    { key: 'd', type: 'BILL', congress: '9' },
  ]
  const groups = groupBillsByCongress(records)
  assert.deepEqual(groups.map(([label]) => label), ['20th Congress', '9th Congress', 'Congress unavailable'])
  assert.strictEqual(groups[1][1][0], records[0])
  assert.deepEqual(groups[1][1].map(row => row.key), ['a', 'd'])
  assert.strictEqual(groups[0][1][0], records[1])
  assert.equal(groups.flatMap(([, bills]) => bills).length, 4)
})

test('formats middle initials while preserving given names, compound surnames, suffixes and punctuation', () => {
  for (const [source, expected] of [
    ['Adam Relson L Jala', 'Adam Relson L. Jala'],
    ['Abdullah D Dimaporo', 'Abdullah D. Dimaporo'],
    ['Juan P de la Cruz Jr.', 'Juan P. de la Cruz Jr.'],
    ['Maria Ana L Santos-Reyes III', 'Maria Ana L. Santos-Reyes III'],
    ['Jose M Osmeña, Sr.', 'Jose M. Osmeña, Sr.'],
    ['Juan P Cruz IV', 'Juan P. Cruz IV'],
    ['Maria L. Santos-Reyes', 'Maria L. Santos-Reyes'],
    ['Ferdinand “Bongbong” Marcos Jr.', 'Ferdinand “Bongbong” Marcos Jr.'],
  ]) {
    assert.deepEqual(formatDisplayName(source), { name: expected, needsReview: false })
  }
})

test('ambiguous initials are unchanged and flagged for review', () => {
  for (const source of ['J Santos', 'Juan A B Cruz', 'Juan A Maria Cruz', 'Juan Santos A', 'Juan “Pepe” A Cruz']) {
    assert.deepEqual(formatDisplayName(source), { name: source, needsReview: true })
  }
  assert.deepEqual(formatDisplayName(''), { name: '', needsReview: false })
  assert.deepEqual(formatDisplayName('Maria Ana de la Cruz'), { name: 'Maria Ana de la Cruz', needsReview: false })
})
