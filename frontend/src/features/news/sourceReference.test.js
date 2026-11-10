import test from 'node:test'
import assert from 'node:assert/strict'
import { usableSourceUrl, isRemovedGovernmentSource } from './sourceReference.js'

test('source display accepts web citations and rejects malformed or executable links', () => {
  assert.equal(usableSourceUrl('https://www.coa.gov.ph/report'), true)
  assert.equal(usableSourceUrl('https://github.com/bettergovph/open-congress-data'), true)
  for (const value of ['', undefined, '/relative', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    assert.equal(usableSourceUrl(value), false)
  }
})

test('removed news publishers are hidden without hiding the remaining sources', () => {
  for (const host of ['senate.gov.ph', 'www.senate.gov.ph', 'legacy.senate.gov.ph', 'www.dost.gov.ph', 'www.da.gov.ph', 'pia.gov.ph']) {
    assert.equal(isRemovedGovernmentSource({ baseUrl: `https://${host}/` }), true)
  }
  for (const host of ['www.dbm.gov.ph', 'www.officialgazette.gov.ph']) {
    assert.equal(isRemovedGovernmentSource({ baseUrl: `https://${host}/` }), false)
  }
})
