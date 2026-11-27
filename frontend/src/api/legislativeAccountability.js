import { API_BASE_URL, readApiResponse } from './client'

export function legislativeAccountabilityPath(politicianId, admin = false) {
  return `/api/${admin ? 'admin/' : ''}politicians/${encodeURIComponent(politicianId)}/legislative-accountability`
}

export function legislativeAccountabilityRequest(path, { token, body, ...options } = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(readApiResponse)
}
