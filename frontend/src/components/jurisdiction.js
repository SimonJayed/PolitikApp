export function normalizeJurisdiction(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized === 'national') return 'NATIONAL'
  if (normalized === 'cebu city' || normalized === 'cebu_city') return 'CEBU_CITY'
  return normalized.toUpperCase()
}

export function matchesJurisdiction(value, filter) {
  if (filter === 'ALL') return true
  return normalizeJurisdiction(value) === filter
}
