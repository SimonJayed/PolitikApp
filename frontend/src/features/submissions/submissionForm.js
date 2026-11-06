export const emptySubmission = {
  politicianId: '',
  sourceUrl: '',
  categoryTag: 'Audit',
  actionIdentifier: 'COA_FINDING',
  actionDetails: {},
  impactSummary: '',
}

export function normalizeActionDetails(actionDetails = {}) {
  return Object.fromEntries(
    Object.entries(actionDetails)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => {
        const numericValue = Number(value)
        return Number.isFinite(numericValue) && value !== null && value !== '' ? [key, numericValue] : [key, value]
      }),
  )
}
