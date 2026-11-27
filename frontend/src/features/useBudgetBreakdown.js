import { useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../api/client'

export function useBudgetBreakdown(politicianId, cardTotal) {
  const [request, setRequest] = useState(null)
  const [result, setResult] = useState(null)
  const isOpen = Boolean(request && request.politicianId === politicianId)
  const open = () => setRequest({ politicianId, cardTotal })

  useEffect(() => {
    if (!isOpen) return undefined
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/politicians/${encodeURIComponent(politicianId)}/budget-breakdown`, { signal: controller.signal })
      .then(readApiResponse)
      .then(data => {
        if (!Array.isArray(data.allocations) || data.recordCount !== data.allocations.length
          || typeof data.exactTotal !== 'string') {
          throw new Error('Budget breakdown is currently unavailable.')
        }
        if (!controller.signal.aborted) setResult({ request, data })
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ request, error: error.message })
      })
    return () => controller.abort()
  }, [politicianId, isOpen, request])

  const current = isOpen && result?.request === request ? result : null
  const freshTotal = result && result.request.politicianId === politicianId && result.request.cardTotal === cardTotal
    ? result.data?.exactTotal : undefined
  return {
    isOpen, open, close: () => setRequest(null), retry: open,
    exactTotal: current?.data?.exactTotal ?? freshTotal ?? cardTotal, data: current?.data, error: current?.error,
  }
}
