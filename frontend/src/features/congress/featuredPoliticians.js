import { normalizePosition } from './politicianDirectory.js'

export function selectFeaturedPoliticians(politicians = [], today) {
  const available = politicians.filter(person => person.status !== 'ARCHIVED')
  const withIndicators = available.filter(person => ['wgiCompositeScore', 'coaAuditDiscrepancies', 'billsAuthored'].some(field => {
    const value = Number(person[field])
    return Number.isFinite(value) && (field === 'wgiCompositeScore' ? value !== 0 : value > 0)
  }))
  const currentSenators = available.filter(person => normalizePosition(person.position) === 'SENATOR'
    && person.status !== 'INACTIVE' && person.termStart && person.termEnd
    && person.termStart <= today && person.termEnd >= today)
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'en-PH', { sensitivity: 'base' }))
  const selected = new Map()
  for (const person of [...withIndicators, ...currentSenators]) {
    if (!selected.has(person.politicianId)) selected.set(person.politicianId, person)
    if (selected.size === 6) break
  }
  return [...selected.values()]
}
