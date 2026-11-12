export const ACCOUNTABILITY_TYPES = {
  PROJECT_COMPLETION: 'Project Completion',
  BUDGET_ALLOCATION: 'Budget Allocation',
  COA_FINDING: 'COA Audit Finding',
  ACCOMPLISHMENT: 'Accomplishment',
}

export function accountabilityRecords(entries = [], accomplishments = []) {
  return [
    ...entries.filter(entry => Object.hasOwn(ACCOUNTABILITY_TYPES, entry.actionIdentifier)
      && entry.actionDetails?.sourceReported !== true && !entry.isHidden
      && (!entry.publicationStatus || entry.publicationStatus === 'PUBLISHED')
      && !['BILL', 'MEMBERSHIP'].includes(entry.actionDetails?.recordType)),
    ...accomplishments.filter(entry => entry.visible).map(entry => ({ ...entry, actionIdentifier: 'ACCOMPLISHMENT' })),
  ]
}

export function filterAccountabilityRecords(records, type, query = '') {
  const q = query.trim().toLowerCase()
  return records.filter(entry => (type === 'ALL' || type === entry.actionIdentifier)
    && (!q || [entry.title, entry.summary, entry.description, entry.impactSummary, entry.categoryTag, entry.category,
      ACCOUNTABILITY_TYPES[entry.actionIdentifier], entry.accomplishmentDate, entry.accomplishmentYear,
      ...Object.values(entry.actionDetails || {}).filter(value => typeof value !== 'object')]
      .some(value => String(value ?? '').toLowerCase().includes(q))))
}

export function numericValue(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function accountabilityMetric(entry) {
  const details = entry.actionDetails || {}
  if (entry.actionIdentifier === 'PROJECT_COMPLETION') {
    const number = numericValue(details.completionPercentage)
    return number === null || number > 100 ? 'Completion percentage unavailable' : `${number}% complete`
  }
  const key = ({ BUDGET_ALLOCATION: 'allocationAmount', COA_FINDING: 'flaggedAmount' })[entry.actionIdentifier]
  if (!key) return null
  const number = numericValue(details[key])
  const label = entry.actionIdentifier === 'COA_FINDING' ? 'Flagged amount' : 'Allocated amount'
  return number === null ? `${label} unavailable` : `${label}: ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(number)}`
}
