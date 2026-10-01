import { ArrowLeftIcon, ArrowRightIcon } from '../components/icons/Lucide'
import KPIWidget from '../components/governance/KPIWidget'
import TimelineLedgerDecoupled from '../components/governance/TimelineLedger'
import { SkeletonLine } from '../components/Skeletons'

export function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0))
}

export function formatActionMetric(actionDetails, actionIdentifier) {
  if (!actionDetails) return 'N/A'
  switch (actionIdentifier) {
    case 'COA_FINDING': return formatCurrency(actionDetails.flaggedAmount)
    case 'BUDGET_ALLOCATION': return formatCurrency(actionDetails.allocationAmount)
    case 'PROJECT_COMPLETION': return `${Number(actionDetails.completionPercentage || 0).toLocaleString('en-PH')}% Completed`
    case 'SPONSORED_LEGISLATION': return [actionDetails.legislationTitle, actionDetails.legislativeStatus, formatDate(actionDetails.dateFiled)].filter(Boolean).join(' | ') || 'Legislation details'
    default: return actionDetails.metric !== undefined ? String(actionDetails.metric) : 'View Details'
  }
}

export function PaginationMini({ page, totalPages, onChange }) {
  return <nav className="paginationMini" aria-label="Pagination">
    <button type="button" disabled={page <= 1} onClick={() => onChange((current) => Math.max(1, current - 1))} className="paginationButton" aria-label="Previous page"><ArrowLeftIcon size={17} strokeWidth={2.4} /></button>
    <span className="paginationText" aria-live="polite">{page} / {totalPages}</span>
    <button type="button" disabled={page >= totalPages} onClick={() => onChange((current) => Math.min(totalPages, current + 1))} className="paginationButton" aria-label="Next page"><ArrowRightIcon size={17} strokeWidth={2.4} /></button>
  </nav>
}

export function StatusLine({ state }) {
  if (!state?.message) return null
  if (state.status === 'loading') return <div className="pageLoadingSkeleton" aria-label={state.message} aria-live="polite"><SkeletonLine width="38%" height={14} /><SkeletonLine width="82%" height={10} /><SkeletonLine width="64%" height={10} /></div>
  return <p className={`statusLine ${state.status}`}>{state.message}</p>
}

export function LoadingSkeletonCards({ count = 4 }) {
  return <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">{Array.from({ length: count }).map((_, index) => <article className="grid min-h-[142px] grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5" key={`s-${index}`}><span className="h-[88px] w-[88px] rounded-xl bg-slate-100 animate-pulse" /><div className="space-y-2.5"><span className="block h-4 w-2/3 rounded bg-slate-100 animate-pulse" /><span className="block h-3 w-1/2 rounded bg-slate-100 animate-pulse" /><span className="block h-3 w-3/5 rounded bg-slate-100 animate-pulse" /></div></article>)}</div>
}

export function ProfileSkeleton() {
  return <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex min-h-[180px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50"><div className="flex items-center gap-3 text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" aria-hidden="true" /><span className="text-sm font-medium">Loading profile</span></div></div></section>
}

export function PageSectionLoader() {
  return <section className="pageSectionSkeleton" aria-label="Loading content" aria-live="polite"><SkeletonLine width="42%" height={18} /><SkeletonLine width="78%" height={12} /><SkeletonLine width="92%" height={12} /><SkeletonLine width="68%" height={12} /></section>
}

export function KpiGrid(props) { return <KPIWidget {...props} /> }
export function TimelineLedger(props) { return <TimelineLedgerDecoupled {...props} /> }
