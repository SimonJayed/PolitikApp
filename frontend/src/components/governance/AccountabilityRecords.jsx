import { publicCitationHref } from '../../api/congress'
import { ACCOUNTABILITY_TYPES, accountabilityMetric } from '../../features/congress/accountabilityRecords'
import { recordDate } from '../../features/congress/legislativeRecords'

export function AccountabilityCard({ entry }) {
  const accomplishment = entry.actionIdentifier === 'ACCOMPLISHMENT'
  const type = ACCOUNTABILITY_TYPES[entry.actionIdentifier] || 'Accountability record'
  const title = entry.title || entry.actionDetails?.projectTitle || entry.actionDetails?.title || type
  const category = entry.categoryTag || entry.category
  const href = publicCitationHref(entry.primarySourceUrl || entry.sourceUrl)
  const metric = accountabilityMetric(entry)
  return <article className="accountabilityCard">
    <div className="accountabilityLabels"><span className="prBadge">{type}</span>{category && <span className="accountabilityCategory">Category: {category}</span>}</div>
    <h3>{title}</h3>
    <p className="accountabilityVerification">{accomplishment ? 'Administrator-curated accomplishment' : 'Administrator-verified record'}</p>
    {accomplishment && <p className="prMuted">{entry.accomplishmentDate ? recordDate(entry.accomplishmentDate) : entry.accomplishmentYear || 'Date not provided'}</p>}
    {metric && <p className="accountabilityMetric">{metric}</p>}
    <p className="accountabilityDescription">{entry.description || entry.summary || entry.impactSummary || 'Description unavailable'}</p>
    {entry.actionIdentifier === 'COA_FINDING' && <p className="accountabilityContext">An audit finding does not by itself establish personal wrongdoing by this politician.</p>}
    {href ? <a href={href} target="_blank" rel="noopener noreferrer">Supporting source<span className="srOnly"> (opens in a new tab)</span></a>
      : <p className="prMuted">Supporting citation unavailable</p>}
  </article>
}

export default function AccountabilityRecords({ entries = [], loading }) {
  if (loading) return <p role="status">Loading verified records…</p>
  return entries.length ? <div className="accountabilityList">{entries.map(entry =>
    <AccountabilityCard key={entry.timelineId || entry.accomplishmentId} entry={entry} />)}</div>
    : <p className="prMuted">No verified accountability records match this selection.</p>
}
