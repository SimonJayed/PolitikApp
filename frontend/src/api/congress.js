import { API_BASE_URL, readApiResponse } from './client'

// Share first-page data between visible cards and the profile; expire reviewed snapshots.
const publicPages = new Map()
export function publicCongressRecords(politicianId, offset = 0, limit = 5, refresh = false, { congress, checkSources = false } = {}) {
  const key = `${politicianId}:${offset}:${limit}:${congress || ''}:${checkSources}`
  const cached = publicPages.get(key)
  if (!refresh && cached && cached.expires > Date.now()) return cached.promise
  const entry = { expires: Date.now() + 30_000 }
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (congress && congress !== 'ALL') params.set('congress', congress)
  if (checkSources) params.set('checkSources', 'true')
  entry.promise = fetch(`${API_BASE_URL}/api/politicians/${encodeURIComponent(politicianId)}/congress-records?${params}`)
    .then(readApiResponse).catch(error => {
      if (publicPages.get(key) === entry) publicPages.delete(key)
      throw error
    })
  if (publicPages.size >= 100) publicPages.delete(publicPages.keys().next().value)
  publicPages.set(key, entry)
  return entry.promise
}

export function congressRequest(path, token, options = {}) {
  return fetch(`${API_BASE_URL}/api/admin/open-congress${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  }).then(readApiResponse)
}

export function congressRecordsPath(previewId) {
  return previewId ? `/previews/${encodeURIComponent(previewId)}/records` : '/records'
}

export function sourceHref(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function publicCitationHref(value) {
  const href = sourceHref(value)
  if (!href) return null
  const url = new URL(href)
  if (['github.com', 'raw.githubusercontent.com'].includes(url.hostname.toLowerCase())
    && /^\/bettergovph\/open-congress-data\//i.test(url.pathname) && /\.toml$/i.test(url.pathname)) return null
  return href
}
