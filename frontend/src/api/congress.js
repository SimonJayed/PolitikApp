import { API_BASE_URL, readApiResponse } from './client'

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
