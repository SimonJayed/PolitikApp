export function ordinal(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return null
  const lastTwo = number % 100
  const ending = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th')
  return `${number}${ending}`
}

export function congressLabel(values = []) {
  const numbers = [...new Set(values.map(Number).filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b)
  const labels = numbers.map(ordinal)
  if (!labels.length) return ''
  const list = labels.length < 3 ? labels.join(' and ') : `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
  return `${list} Congress${labels.length === 1 ? '' : 'es'}`
}

export function chamberLabel(value) {
  return ({ senate: 'Senate', house: 'House of Representatives' })[String(value || '').toLowerCase()] || null
}

export function membershipSummary(memberships = []) {
  const chambers = new Set(memberships.map(m => chamberLabel(m.chamber)).filter(Boolean))
  return {
    chamber: chambers.size === 2 ? 'Both' : [...chambers][0] || null,
    congresses: congressLabel(memberships.map(m => m.congress)),
  }
}

export function summarizeMemberships(memberships = []) {
  const chambers = new Map()
  for (const membership of memberships) {
    const chamber = chamberLabel(membership.chamber)
    const congress = ordinal(membership.congress)
    if (!chamber && !congress) continue
    const label = chamber || 'Chamber unavailable'
    if (!chambers.has(label)) chambers.set(label, [])
    chambers.get(label).push(membership.congress)
  }
  return [...chambers.entries()].map(([chamber, numbers]) =>
    `${chamber}: ${congressLabel(numbers) || 'Congress number unavailable'}`)
}

export function groupBillsByCongress(records = []) {
  const groups = new Map()
  for (const record of records.filter(record => record.type === 'BILL')) {
    const label = ordinal(record.congress) ? `${ordinal(record.congress)} Congress` : 'Congress unavailable'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(record)
  }
  return [...groups.entries()].sort(([a], [b]) => (parseInt(b) || 0) - (parseInt(a) || 0))
}
