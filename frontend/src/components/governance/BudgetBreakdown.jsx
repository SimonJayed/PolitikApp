import BaseModal from '../BaseModal'
import { publicCitationHref } from '../../api/congress'
import { formatCompactPhp, formatExactPhp } from '../../features/formatCurrency'
import { useBudgetBreakdown } from '../../features/useBudgetBreakdown'
import { REVIEW_STATUS_LABELS } from '../../features/verification/citationReviews'
import { LandmarkIcon } from '../icons/Lucide'
import { HelpCircleIcon } from './WgiMethodologyModal'
import './BudgetBreakdown.css'

const percentFormat = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 })

export function BudgetBreakdownAction({ onClick }) {
  return <button type="button" className="budgetBreakdownAction" aria-haspopup="dialog" onClick={onClick}>
    View Breakdown
  </button>
}

function Allocation({ record }) {
  const href = record.verificationStatus === 'INVALID_SOURCE' ? null : publicCitationHref(record.sourceUrl)
  const percent = record.contributionPercentage
  const barValue = percent == null ? 0 : Math.max(0, Math.min(percent, 100))
  return <li>
    <div className="budgetAllocationHeading">
      <h3>{record.title || 'Allocation title unavailable'}</h3>
      <strong>{formatExactPhp(record.exactAmount)}</strong>
    </div>
    <div className="budgetAllocationMetadata">
      <span>{record.fiscalYear ? `FY ${record.fiscalYear}` : 'Fiscal year unavailable'}</span>
      <span>{REVIEW_STATUS_LABELS[record.verificationStatus] || 'Unverified'}</span>
      <span>{record.sourceOrganization || 'Source organization unavailable'}</span>
    </div>
    <p className="budgetAllocationShare">{percent == null ? 'Share unavailable'
      : `${percent > 0 && percent < 0.01 ? '<0.01' : percentFormat.format(percent)}% of total`}</p>
    {percent != null && <div className="budgetAllocationBar" aria-hidden="true">
      <span style={{ width: `${barValue}%` }} />
    </div>}
    {href ? <a href={href} target="_blank" rel="noopener noreferrer">Supporting source<span className="srOnly"> (opens in a new tab)</span></a>
      : <span className="budgetAllocationNoSource">Supporting citation unavailable</span>}
  </li>
}

export function BudgetBreakdownModal({ view }) {
  const { isOpen, close, retry, data, error } = view
  return <BaseModal isOpen={isOpen} onClose={close} title="Budget Tracked breakdown" modalClassName="budgetBreakdownDialog">
    <p className="budgetBreakdownIntro">This total reflects public budget allocations recorded in PolitikApp. Actual expenditures and personal funds are separate.</p>
    {!data && !error && <p role="status">Loading budget allocations…</p>}
    {error && <p role="alert">{error} <button type="button" className="budgetBreakdownAction" onClick={retry}>Retry</button></p>}
    {data && <>
      <div className="budgetBreakdownSummary">
        <div><span>Exact total</span><strong>{formatExactPhp(data.exactTotal)}</strong></div>
        <span>{data.recordCount.toLocaleString('en-PH')} contributing {data.recordCount === 1 ? 'record' : 'records'}</span>
      </div>
      {data.allocations.length > 0
        ? <ol className="budgetBreakdownAllocations">{data.allocations.map(record => <Allocation key={record.recordId} record={record} />)}</ol>
        : <p className="budgetAllocationNoSource">No eligible budget allocation records are available for this politician.</p>}
    </>}
  </BaseModal>
}

export function MobileBudgetTracked({ politicianId, total }) {
  const view = useBudgetBreakdown(politicianId, total)
  return <article className="mobileCard budgetTrackedMobile" data-indicator="trackedBudgetAllocated">
    <div className="kpiIndicatorTop">
      <span className="kpiIndicatorIcon"><LandmarkIcon size={20} /></span>
      <button type="button" className="kpiIndicatorHelp" onClick={view.open} aria-haspopup="dialog" aria-label="About Budget Tracked">
        <HelpCircleIcon size={20} />
      </button>
    </div>
    <h3>Budget Tracked</h3>
    <strong className="metricCurrency">{formatCompactPhp(view.exactTotal)}</strong>
    <BudgetBreakdownAction onClick={view.open} />
    <BudgetBreakdownModal view={view} />
  </article>
}
