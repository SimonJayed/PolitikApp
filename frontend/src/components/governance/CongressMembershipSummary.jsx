import { LoadingSkeleton } from "../Skeletons"
import { membershipSummary, summarizeMemberships } from '../../features/congress/congressHistory'
import { useCongressMemberships } from '../../features/congress/useCongressMemberships'
import './CongressMembershipSummary.css'

export default function CongressMembershipSummary({ politicianId, detailed = false }) {
  const state = useCongressMemberships(politicianId)
  if (state.status === 'loading') return <LoadingSkeleton inline label="Loading congressional membership" />
  if (state.status === 'error') return <span role="status" title={state.error}>Congressional membership could not be loaded. Reopen this profile to retry.</span>
  const summary = membershipSummary(state.memberships)
  return <span className="congressMembershipSummary">
    {summary.chamber && <strong>{summary.chamber}</strong>}
    {detailed
      ? summarizeMemberships(state.memberships).map(history => <span key={history}>{history}</span>)
      : summary.congresses && <span>{summary.congresses}</span>}
    {(!summary.chamber || !summary.congresses) && <span>Congressional membership unavailable</span>}
  </span>
}
