import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCompactPhp, formatExactPhp } from './formatCurrency.js'

test('compact Philippine pesos use K, M, B and T with at most three decimals', () => {
  assert.equal(formatCompactPhp(125500), '₱125.5K')
  assert.equal(formatCompactPhp(159245000), '₱159.245M')
  assert.equal(formatCompactPhp('2175000000.20'), '₱2.175B')
  assert.equal(formatCompactPhp(2175000000000), '₱2.175T')
  assert.equal(formatCompactPhp(999999.9), '₱1M')
  assert.equal(formatCompactPhp('125543.50'), '₱125.544K')
  assert.equal(formatCompactPhp('-4000'), '-₱4K')
  assert.equal(formatCompactPhp(0), '₱0')
  assert.equal(formatCompactPhp(''), 'Unavailable')
  assert.equal(formatCompactPhp(Number.NaN), 'Unavailable')
})

test('exact currency groups full decimal strings without rounding or losing integer digits', () => {
  assert.equal(formatExactPhp('9007199254740993.470'), '₱9,007,199,254,740,993.470')
  assert.equal(formatExactPhp('2175024000.12345'), '₱2,175,024,000.12345')
  assert.equal(formatExactPhp('0'), '₱0.00')
  assert.equal(formatExactPhp('-18.5'), '-₱18.50')
  assert.equal(formatExactPhp(null), 'Unavailable')
})
