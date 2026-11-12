import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { authoredBills, billTitle, chronologicalHistory, reportedStatuses } from './legislativeRecords.js'
import { accountabilityMetric, accountabilityRecords, filterAccountabilityRecords } from './accountabilityRecords.js'

let server, LegislativeCard, AccountabilityCard
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../../../', import.meta.url)), server: { middlewareMode: true, watch: null }, appType: 'custom' })
  ;({ LegislativeCard } = await server.ssrLoadModule('/src/components/governance/CongressSourceSection.jsx'))
  ;({ AccountabilityCard } = await server.ssrLoadModule('/src/components/governance/AccountabilityRecords.jsx'))
})
after(async () => { await server?.close() })

const bill = { key: 'bill:one', type: 'BILL', authorPoliticianId: 'selected', relationshipType: 'AUTHORED_BY', congress: 16,
  title: 'ACQUISITION OF RIGHT-OF-WAY', chamber: 'senate', billNumber: '2145', filedDate: '2014-02-26',
  reportedStatus: '[{"date":"2014-03-01","status":"Consolidated/Substituted in the Committee Report"}]',
  history: [{ date: '2014-02-26', action: 'Filed with the Senate' }, {}, { date: '2014-02-27', text: 'Read on First Reading' }],
  sourceUrl: 'https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=16&q=SBN-2145',
  datasetUrl: 'https://github.com/bettergovph/open-congress-data/blob/commit/record.toml', originalSourceStatus: 'AVAILABLE' }

test('authorship must explicitly belong to the selected politician; membership and association are excluded', () => {
  assert.deepEqual(authoredBills([bill, { ...bill, relationshipType: 'CO_AUTHORED_BY' }, { ...bill, relationshipType: 'SPONSORED_BY' },
    { ...bill, authorPoliticianId: 'another-person' }, { ...bill, relationshipType: undefined }, { ...bill, type: 'MEMBERSHIP' }], 'selected'), [bill])
})

test('history handles JSON strings, nested actions, text, and dated maps without empty events', () => {
  const rows = chronologicalHistory(JSON.stringify([{ date: '2024-02-02', description: 'Referred' }, { date: '2024-02-01', action: 'Filed' }, {}, { date: '2024-02-03' }, null, '']))
  assert.deepEqual(rows.map(row => row.description), ['Filed', 'Referred'])
  assert.deepEqual(chronologicalHistory({ '2024-01-01': ['Filed', 'Read'] }), [{ date: '2024-01-01', description: 'Filed' }, { date: '2024-01-01', description: 'Read' }])
  assert.deepEqual(chronologicalHistory({ actions: [{ text: 'Reviewed' }, {}] }), [{ date: '', description: 'Reviewed' }])
  assert.deepEqual(chronologicalHistory({ date: '2024-01-01', action: ['Filed', 'Read'] }), [{ date: '2024-01-01', description: 'Filed' }, { date: '2024-01-01', description: 'Read' }])
  assert.deepEqual(reportedStatuses('"Pending in the Committee"'), [{ date: '', status: 'Pending in the Committee' }])
  assert.deepEqual(chronologicalHistory([{}, null, { date: '' }]), [])
})

test('bill display separates title/authorship, retains dates/status/history and only confirmed original links', () => {
  assert.equal(billTitle(bill), 'SB 2145: Acquisition of Right-of-Way')
  assert.equal(bill.title, 'ACQUISITION OF RIGHT-OF-WAY')
  const html = renderToStaticMarkup(createElement(LegislativeCard, { record: bill }))
  for (const text of ['SB 2145: Acquisition of Right-of-Way', 'Authorship:', 'Source-reported author', '16th Congress', 'February 26, 2014', 'Consolidated/Substituted', 'Read on First Reading', 'not independently verified', 'Original Source']) assert.ok(html.includes(text), text)
  assert.ok(html.includes('congress=16&amp;q=SBN-2145'))
  assert.ok(html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'))
  assert.ok(!html.includes('github.com') && !html.includes('Dataset record'))
  assert.equal((html.match(/<li>/g) || []).length, 2)
  for (const status of ['UNAVAILABLE', 'UNCONFIRMED']) {
    const unavailable = renderToStaticMarkup(createElement(LegislativeCard, { record: { ...bill, history: [{}], originalSourceStatus: status } }))
    assert.ok(unavailable.includes('Original source unavailable') && unavailable.includes('Legislative history unavailable'))
    assert.ok(!unavailable.includes('href=') && !unavailable.includes('<li>'))
  }
})

test('public accountability lists exclude legislation and hidden/source-reported records while retaining visible accomplishments', () => {
  const timeline = ['PROJECT_COMPLETION', 'BUDGET_ALLOCATION', 'COA_FINDING', 'SPONSORED_LEGISLATION', 'CONGRESSIONAL_MEMBERSHIP'].map(actionIdentifier => ({ timelineId: actionIdentifier, actionIdentifier }))
  const records = accountabilityRecords([...timeline, { actionIdentifier: 'COA_FINDING', isHidden: true },
    { actionIdentifier: 'BUDGET_ALLOCATION', actionDetails: { sourceReported: true } }], [
    { accomplishmentId: 'visible', title: 'Public service award', accomplishmentYear: 2025, visible: true },
    { accomplishmentId: 'private', visible: false }])
  assert.equal(records.length, 4)
  assert.equal(filterAccountabilityRecords(records, 'ACCOMPLISHMENT', '2025').length, 1)
  assert.equal(filterAccountabilityRecords(records, 'COA_FINDING').length, 1)
  assert.equal(timeline.length, 5) // Existing curated legislation remains untouched.
})

test('numeric cards show PHP amounts and completion percentages without inventing missing values', () => {
  assert.equal(accountabilityMetric({ actionIdentifier: 'BUDGET_ALLOCATION', actionDetails: { allocationAmount: 1250 } }), 'Allocated amount: ₱1,250.00')
  assert.equal(accountabilityMetric({ actionIdentifier: 'COA_FINDING', actionDetails: { flaggedAmount: 0 } }), 'Flagged amount: ₱0.00')
  assert.equal(accountabilityMetric({ actionIdentifier: 'PROJECT_COMPLETION', actionDetails: { completionPercentage: 75 } }), '75% complete')
  assert.equal(accountabilityMetric({ actionIdentifier: 'PROJECT_COMPLETION', actionDetails: { completionPercentage: 101 } }), 'Completion percentage unavailable')
  assert.equal(accountabilityMetric({ actionIdentifier: 'BUDGET_ALLOCATION', actionDetails: { allocationAmount: null } }), 'Allocated amount unavailable')
  const html = renderToStaticMarkup(createElement(AccountabilityCard, { entry: { actionIdentifier: 'COA_FINDING', categoryTag: 'Audit', summary: 'Documented finding.', actionDetails: { flaggedAmount: 25000 }, sourceUrl: 'https://www.coa.gov.ph/report' } }))
  for (const text of ['COA Audit Finding', 'Category: Audit', 'Administrator-verified record', '₱25,000.00', 'Documented finding.', 'does not by itself establish personal wrongdoing', 'Supporting source']) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('FindingAudit'))
  const unsafe = renderToStaticMarkup(createElement(AccountabilityCard, { entry: { actionIdentifier: 'BUDGET_ALLOCATION', sourceUrl: 'javascript:alert(1)' } }))
  assert.ok(!unsafe.includes('href=') && unsafe.includes('Supporting citation unavailable'))
  const dataset = renderToStaticMarkup(createElement(AccountabilityCard, { entry: { actionIdentifier: 'BUDGET_ALLOCATION', sourceUrl: bill.datasetUrl } }))
  assert.ok(!dataset.includes('href=') && !dataset.includes('github.com'))
})
