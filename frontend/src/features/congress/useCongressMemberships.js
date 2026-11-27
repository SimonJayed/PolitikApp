import { useEffect, useState } from 'react'
import { publicCongressRecords } from '../../api/congress'
import { legislativeAccountabilityPath, legislativeAccountabilityRequest } from '../../api/legislativeAccountability'

export function useCongressMemberships(politicianId) {
  const [state, setState] = useState({ id: null, status: 'loading', memberships: [], error: '' })
  useEffect(() => {
    if (!politicianId) return undefined
    let active = true
    publicCongressRecords(politicianId)
      .then(page => { if (active) setState({ id: politicianId, status: 'ready', memberships: page.memberships || [], authoredCount: page.total || 0, error: '' }) })
      .catch(error => { if (active) setState({ id: politicianId, status: 'error', memberships: [], error: error.message }) })
    return () => { active = false }
  }, [politicianId])
  return state.id === politicianId ? state : { status: 'loading', memberships: [], error: '' }
}

export function useLegislativeAccountabilityAvailability(politicianId) {
  const [confirmedId, setConfirmedId] = useState(null)
  useEffect(() => {
    if (!politicianId) return undefined
    const controller = new AbortController()
    legislativeAccountabilityRequest(`${legislativeAccountabilityPath(politicianId)}?limit=1`, { signal: controller.signal })
      .then(page => {
        if (!controller.signal.aborted) setConfirmedId(page.records?.length ? politicianId : null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfirmedId(null)
      })
    return () => controller.abort()
  }, [politicianId])
  return Boolean(politicianId && politicianId === confirmedId)
}
