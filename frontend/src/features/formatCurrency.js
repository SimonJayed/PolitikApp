const compactPhp = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 3,
})
const wholeDigits = new Intl.NumberFormat('en-PH')
const decimal = /^(-?)(\d+)(?:\.(\d+))?(?:e[+-]?\d+)?$/i

function amount(value) {
  if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'bigint') return String(value)
  if (typeof value === 'string' && decimal.test(value.trim())) return value.trim()
  return null
}

export function formatCompactPhp(value) {
  const digits = amount(value)
  return digits === null ? 'Unavailable' : compactPhp.format(digits)
}

// The breakdown supplies a plain decimal string. Group its digits without rounding cents or converting to Number.
export function formatExactPhp(value) {
  const digits = amount(value)
  const match = digits?.match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match) return 'Unavailable'
  const [, sign, whole, fraction = ''] = match
  return `${sign}₱${wholeDigits.format(BigInt(whole))}.${fraction.padEnd(2, '0')}`
}
