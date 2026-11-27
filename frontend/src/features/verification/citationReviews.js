import { useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'

export const REVIEW_STATUS_LABELS = {
  VERIFIED: 'Verified',
  PENDING_VERIFICATION: 'Pending verification',
  UNVERIFIED: 'Unverified',
  INVALID_SOURCE: 'Invalid source',
}

const empty = new Map()

export function useCitationReviews(politicianId) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!politicianId) return undefined
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/politicians/${encodeURIComponent(politicianId)}/citation-reviews`, { signal: controller.signal })
      .then(readApiResponse)
      .then(rows => {
        if (Array.isArray(rows) && !controller.signal.aborted) {
          setResult({ politicianId, reviews: new Map(rows.map(row => [row.id, row])) })
        }
      }).catch(() => { /* A missing review never implies verification. */ })
    return () => controller.abort()
  }, [politicianId])
  return result?.politicianId === politicianId ? result.reviews : empty
}
