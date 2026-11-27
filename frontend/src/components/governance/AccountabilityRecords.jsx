import { LoadingSkeleton } from "../Skeletons"
import { publicCitationHref } from '../../api/congress'
import { ACCOUNTABILITY_TYPES, accountabilityMetric } from '../../features/congress/accountabilityRecords'
import { recordDate } from '../../features/congress/legislativeRecords'
import { REVIEW_STATUS_LABELS } from '../../features/verification/citationReviews'

export function AccountabilityCard({ entry, review }) {
  const accomplishment = entry.actionIdentifier === 'ACCOMPLISHMENT'
  const legislation = entry.actionIdentifier === 'SPONSORED_LEGISLATION'
  const audit = entry.actionIdentifier === 'COA_FINDING'
  const type = (legislation ? 'Legislative record' : ACCOUNTABILITY_TYPES[entry.actionIdentifier]) || 'Accountability record'
  const title = entry.title || entry.actionDetails?.legislationTitle || entry.actionDetails?.projectTitle || entry.actionDetails?.title || type
  const category = entry.categoryTag || entry.category
  const href = review?.status === 'INVALID_SOURCE' ? null
    : publicCitationHref(review?.sourceUrl) || publicCitationHref(entry.primarySourceUrl) || publicCitationHref(entry.sourceUrl)
  const metric = accountabilityMetric(entry)
  return <article className={audit ? "accountabilityCard accountabilityAudit" : "accountabilityCard"}>
    <div className="accountabilityLabels"><span className="prBadge">{type}</span>{category && <span className="accountabilityCategory">Category: {category}</span>}</div>
    <h3>{title}</h3>
    <p className="accountabilityVerification">{REVIEW_STATUS_LABELS[review?.status] ?? 'Unverified'}
      {review?.sourceOrganization && ` · ${review.sourceOrganization}`}</p>
    {accomplishment && <p className="prMuted">{entry.accomplishmentDate ? recordDate(entry.accomplishmentDate) : entry.accomplishmentYear || 'Date not provided'}</p>}
    {legislation && entry.actionDetails?.legislativeStatus && <p className="prMuted">{entry.actionDetails.legislativeStatus}</p>}
    {legislation && entry.actionDetails?.dateFiled && <p className="prMuted">{recordDate(entry.actionDetails.dateFiled)}</p>}
    {metric && <p className="accountabilityMetric">{metric}</p>}
    {legislation ? <details><summary>Record details</summary><p className="accountabilityDescription">{entry.description || entry.summary || entry.impactSummary || 'Description unavailable'}</p></details>
      : <p className="accountabilityDescription">{entry.description || entry.summary || entry.impactSummary || 'Description unavailable'}</p>}
    {audit && <p className="accountabilityContext">
      {review?.attribution === 'ASSOCIATED_AGENCY' ? 'This finding concerns an associated government agency. '
        : review?.attribution === 'DIRECT' ? 'The source directly identifies this official. ' : 'Attribution is unconfirmed. '}
      An audit finding does not by itself establish personal wrongdoing by this politician.
    </p>}
    {href ? <a href={href} target="_blank" rel="noopener noreferrer">{legislation ? "View Legislative Record" : "Supporting source"}<span className="srOnly"> (opens in a new tab)</span></a>
      : <p className="prMuted">{legislation || audit ? "Original source unavailable" : "Supporting citation unavailable"}</p>}
  </article>
}

export default function AccountabilityRecords({ entries = [], reviews, loading, emptyMessage = "No accountability records match this selection." }) {
  if (loading) return <LoadingSkeleton label="Loading accountability records" />
  return entries.length ? <div className="accountabilityList">{entries.map(entry =>
    <AccountabilityCard key={entry.timelineId || entry.accomplishmentId} entry={entry}
      review={reviews?.get(entry.timelineId || entry.accomplishmentId)} />)}</div>
    : <p className="prMuted prEmptyState">{emptyMessage}</p>
}
