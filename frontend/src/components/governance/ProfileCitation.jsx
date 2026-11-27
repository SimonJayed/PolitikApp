import { publicCitationHref } from '../../api/congress'
import { REVIEW_STATUS_LABELS } from '../../features/verification/citationReviews'

export default function ProfileCitation({ review }) {
  const href = review?.status === 'VERIFIED' ? publicCitationHref(review.sourceUrl) : null
  return <p className="prMuted">
    Profile sources · {REVIEW_STATUS_LABELS[review?.status] ?? 'Unverified'}
    {href && <> · <a href={href} target="_blank" rel="noreferrer">{review.sourceOrganization || 'Supporting source'}</a></>}
    {review?.reviewedAt && <> · Reviewed {new Date(review.reviewedAt).toLocaleDateString('en-PH')}</>}
  </p>
}
