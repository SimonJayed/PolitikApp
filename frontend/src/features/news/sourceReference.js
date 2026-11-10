export function usableSourceUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}

export function isRemovedGovernmentSource(source) {
  try {
    const host = new URL(source.baseUrl).hostname.toLowerCase().replace(/^www\./, '')
    return ['senate.gov.ph', 'legacy.senate.gov.ph', 'dost.gov.ph', 'da.gov.ph', 'pia.gov.ph'].includes(host)
  } catch { return false }
}
