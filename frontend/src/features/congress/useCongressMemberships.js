import { useEffect, useState } from 'react'
import { publicCongressRecords } from '../../api/congress'

export function useCongressMemberships(politicianId) {
  const [state, setState] = useState({ id: null, status: 'loading', memberships: [], error: '' })
  useEffect(() => {
    let active = true
    publicCongressRecords(politicianId)
      .then(page => { if (active) setState({ id: politicianId, status: 'ready', memberships: page.memberships || [], error: '' }) })
      .catch(error => { if (active) setState({ id: politicianId, status: 'error', memberships: [], error: error.message }) })
    return () => { active = false }
  }, [politicianId])
  return state.id === politicianId ? state : { status: 'loading', memberships: [], error: '' }
}
