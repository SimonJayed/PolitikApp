import { ArrowLeftIcon, ArrowRightIcon } from '../components/icons/Lucide'
import KPIWidget from '../components/governance/KPIWidget'
import TimelineLedgerDecoupled from '../components/governance/TimelineLedger'
import { paginationHandlers } from './pagination'

export function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

export function PaginationMini({ page, totalPages, onChange, disabled = false }) {
  const { previous, next } = paginationHandlers(page, totalPages, onChange)
  return <nav className="paginationMini" aria-label="Pagination">
    <button type="button" disabled={disabled || page <= 1} onClick={previous} className="paginationButton" aria-label="Previous page"><ArrowLeftIcon size={17} strokeWidth={2.4} /></button>
    <span className="paginationText" aria-live="polite">{page} / {totalPages}</span>
    <button type="button" disabled={disabled || page >= totalPages} onClick={next} className="paginationButton" aria-label="Next page"><ArrowRightIcon size={17} strokeWidth={2.4} /></button>
  </nav>
}

export function StatusLine({ state }) {
  if (!state?.message) return null
  if (state.status === 'loading') return null
  return <p className={`statusLine ${state.status}`}>{state.message}</p>
}

export function LoadingSkeletonCards({ count = 4 }) {
  return <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">{Array.from({ length: count }).map((_, index) => <article className="grid min-h-[142px] grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5" key={`s-${index}`}><span className="h-[88px] w-[88px] rounded-xl bg-slate-100 animate-pulse" /><div className="space-y-2.5"><span className="block h-4 w-2/3 rounded bg-slate-100 animate-pulse" /><span className="block h-3 w-1/2 rounded bg-slate-100 animate-pulse" /><span className="block h-3 w-3/5 rounded bg-slate-100 animate-pulse" /></div></article>)}</div>
}

export function ProfileSkeleton() {
  return <PageSkeleton variant="profile" />
}

export function PageSectionLoader() {
  return <PageSkeleton variant="section" />
}

export function InlineSkeleton() {
  return <span className="inlineSkeleton" aria-hidden="true" />
}

export function PageSkeleton({ variant = 'default' }) {
  const cardCount = variant === 'compare' ? 6 : variant === 'admin' ? 5 : 4
  return (
    <section className={`pageSkeleton pageSkeleton-${variant}`} aria-label="Loading page" aria-busy="true">
      <div className="pageSkeletonHero">
        <span className="pageSkeletonLine pageSkeletonTitle" />
        <span className="pageSkeletonLine pageSkeletonSubtitle" />
      </div>
      <div className="pageSkeletonToolbar">
        <span className="pageSkeletonControl pageSkeletonControlWide" />
        <span className="pageSkeletonControl" />
      </div>
      <div className="pageSkeletonGrid">
        {Array.from({ length: cardCount }).map((_, index) => (
          <article className="pageSkeletonCard" key={index}>
            <span className="pageSkeletonAvatar" />
            <div>
              <span className="pageSkeletonLine pageSkeletonCardTitle" />
              <span className="pageSkeletonLine pageSkeletonCardText" />
              <span className="pageSkeletonLine pageSkeletonCardTextShort" />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function KpiGrid(props) { return <KPIWidget {...props} /> }
export function TimelineLedger(props) { return <TimelineLedgerDecoupled {...props} /> }
