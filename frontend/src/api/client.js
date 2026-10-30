export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')).replace(/\/$/, '')

export async function readApiResponse(response) {
  if (response.ok && response.status === 204) return {}
  const contentType = response.headers?.get?.('content-type') || ''
  if (response.ok && contentType && !contentType.toLowerCase().includes('json')) {
    throw new Error('The API returned a web page instead of data. Check VITE_API_BASE_URL and the backend route.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.message || `Request failed with status ${response.status}`)
  }
  if (body === null) throw new Error('The API returned invalid data. Check VITE_API_BASE_URL and the backend route.')
  return body
}
