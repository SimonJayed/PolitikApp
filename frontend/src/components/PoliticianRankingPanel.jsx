import { useMemo, useState } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from './icons/Lucide'
import { matchesJurisdiction } from './jurisdiction'
import { RankingRowsSkeleton } from './Skeletons'
import { computeWgiCompositeScore } from './module1/positionConfig'

function formatWgi(value) {
  return `${Number(value || 0).toFixed(1)}`
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 0,
    style: 'currency',
  })
}

/**
 * Resolves the WGI composite score for a politician row.
 * Prefers the server-computed `wgiCompositeScore` field; falls back to
 * computing it client-side from raw inputs when the field is absent (e.g.
 * older API responses or comparison matrix payloads).
 */
function resolveWgiScore(politician) {
  if (Number.isFinite(Number(politician.wgiCompositeScore)) && Number(politician.wgiCompositeScore) > 0) {
    return Number(politician.wgiCompositeScore)
  }
  // Client-side fallback: compute from raw fields
  return computeWgiCompositeScore(
    politician.position,
    Number(politician.billsAuthored || 0),
    Number(politician.projectCompletions || 0),
    Number(politician.trackedBudgetAllocated || 0),
    Number(politician.coaAuditDiscrepancies || 0),
  )
}

const SORT_OPTIONS = [
  { key: 'wgi',      label: 'WGI Composite Score' },
  { key: 'bills',    label: 'Bills / Ordinances' },
  { key: 'projects', label: 'Projects Completed' },
  { key: 'budget',   label: 'Budget Tracked' },
  { key: 'coa',      label: 'COA Findings' },
]

function metricValue(politician, key) {
  if (key === 'bills')    return Number(politician.billsAuthored || 0)
  if (key === 'projects') return Number(politician.projectCompletions || 0)
  if (key === 'budget')   return Number(politician.trackedBudgetAllocated || 0)
  if (key === 'coa')      return Number(politician.coaAuditDiscrepancies || 0)
  return Number(politician._wgiScore || 0)
}

function compareByMetric(a, b, key) {
  const aValue = metricValue(a, key)
  const bValue = metricValue(b, key)
  // COA: lower is better (ascending); everything else: higher is better (descending)
  return key === 'coa' ? aValue - bValue : bValue - aValue
}

function PoliticianRankingPanel({ isLoading = false, onSelectPolitician, politicians = [] }) {
  const [sortBy, setSortBy]   = useState('wgi')
  const [pages, setPages]     = useState({ CEBU_CITY: 1, NATIONAL: 1 })
  const pageSize = 10
  const activeSortLabel = SORT_OPTIONS.find((opt) => opt.key === sortBy)?.label || 'WGI Composite Score'

  const ranked = useMemo(() => {
    // Attach pre-resolved WGI scores to avoid re-computing on each comparison
    const withScores = politicians.map((p) => ({ ...p, _wgiScore: resolveWgiScore(p) }))

    const priority = [sortBy, ...['wgi', 'bills', 'projects', 'budget', 'coa'].filter((m) => m !== sortBy)]

    return withScores.sort((a, b) => {
      for (const metric of priority) {
        const diff = compareByMetric(a, b, metric)
        if (diff !== 0) return diff
      }
      return String(a.fullName || '').localeCompare(String(b.fullName || ''))
    })
  }, [politicians, sortBy])

  const national = ranked.filter((p) => matchesJurisdiction(p.jurisdiction, 'NATIONAL'))
  const cebuCity = ranked.filter((p) => matchesJurisdiction(p.jurisdiction, 'CEBU_CITY'))
  const scopes = [
    { key: 'NATIONAL',  title: 'National Ranking',   rows: national },
    { key: 'CEBU_CITY', title: 'Cebu City Ranking',  rows: cebuCity },
  ]

  return (
    <section className="rankingPanelWrap">
      <div className="rankingFilterBar">
        <label>
          Sort by
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPages({ CEBU_CITY: 1, NATIONAL: 1 }) }}>
            {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
          </select>
        </label>
      </div>
      {scopes.map((scope) => (
        <article className="rankingPanel" key={scope.key}>
          {(() => {
            const totalPages   = Math.max(1, Math.ceil(scope.rows.length / pageSize))
            const currentPage  = Math.min(pages[scope.key] || 1, totalPages)
            const startIndex   = (currentPage - 1) * pageSize
            const pageRows     = scope.rows.slice(startIndex, currentPage * pageSize)
            return (
              <>
          <header className="rankingPanelHeader">
            <h3 className="ty-card-title">{scope.title}</h3>
            <small className="ty-meta">Sorted by {activeSortLabel}</small>
          </header>
          {isLoading ? (
            <RankingRowsSkeleton rows={6} />
          ) : (
          <div className="rankingPanelTable" role="list">
            {scope.rows.length === 0 && <p className="emptyState">No profiles available.</p>}
            {pageRows.map((row, index) => (
              <button
                className="rankingRow"
                key={row.politicianId}
                onClick={() => onSelectPolitician?.(row.politicianId)}
                role="listitem"
                type="button"
              >
                <span className="rankingRank">#{startIndex + index + 1}</span>
                <span className="rankingIdentity">
                  <strong className="ty-card-title">{row.fullName}</strong>
                  <small className="ty-meta">{row.position || 'Position unavailable'}</small>
                </span>
                <span className="rankingMetric" title="WGI Composite Score">
                  {formatWgi(row._wgiScore)}
                  <small style={{ fontSize: '10px', opacity: 0.65, marginLeft: '2px' }}>WGI</small>
                </span>
                <span className="rankingBudget">{formatCurrency(row.trackedBudgetAllocated || 0)}</span>
                <span className="rankingFlags">
                  {Number(row.coaAuditDiscrepancies || 0) > 0 ? (
                    <span className="rankingFlagBadge">
                      <AlertTriangleIcon size={13} />
                      COA {row.coaAuditDiscrepancies}
                    </span>
                  ) : (
                    <small className="ty-meta">No COA flags</small>
                  )}
                </span>
              </button>
            ))}
          </div>
          )}
          <nav className="paginationMini rankingPagination" aria-label={`${scope.title} pagination`}>
              <button
                type="button"
                className="paginationButton"
                disabled={currentPage <= 1}
                onClick={() => setPages((current) => ({ ...current, [scope.key]: Math.max(1, (current[scope.key] || 1) - 1) }))}
                aria-label={`Previous ${scope.title} page`}
              >
                <ArrowLeftIcon size={17} strokeWidth={2.4} />
              </button>
              <span className="paginationText">{currentPage} / {totalPages}</span>
              <button
                type="button"
                className="paginationButton"
                disabled={currentPage >= totalPages}
                onClick={() => setPages((current) => ({ ...current, [scope.key]: Math.min(totalPages, (current[scope.key] || 1) + 1) }))}
                aria-label={`Next ${scope.title} page`}
              >
                <ArrowRightIcon size={17} strokeWidth={2.4} />
              </button>
            </nav>
          </>
            )
          })()}
        </article>
      ))}
    </section>
  )
}

export default PoliticianRankingPanel
