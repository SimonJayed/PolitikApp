import { useMemo, useState } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from './icons/Lucide'
import { matchesJurisdiction } from './jurisdiction'
import { RankingRowsSkeleton } from './Skeletons'

function formatPercent(value) {
  const numericValue = Number(value || 0)
  return `${numericValue.toFixed(1)}%`
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 0,
    style: 'currency',
  })
}

function getEfficiencyMetric(politician) {
  if (Number.isFinite(Number(politician.legislativeEfficiencyRatio))) {
    return Number(politician.legislativeEfficiencyRatio)
  }
  if (Number.isFinite(Number(politician.efficiencyRatio))) {
    return Number(politician.efficiencyRatio)
  }
  const authored = Number(politician.billsAuthored || 0)
  const completed = Number(politician.projectCompletions || 0)
  if (authored <= 0) return 0
  return (completed / authored) * 100
}

const SORT_OPTIONS = [
  { key: 'efficiency', label: 'Legislative Efficiency' },
  { key: 'bills', label: 'Bills Authored' },
  { key: 'projects', label: 'Projects Completed' },
  { key: 'coa', label: 'COA Findings' },
]

function metricValue(politician, key) {
  if (key === 'bills') return Number(politician.billsAuthored || 0)
  if (key === 'projects') return Number(politician.projectCompletions || 0)
  if (key === 'coa') return Number(politician.coaAuditDiscrepancies || 0)
  return Number(politician.rankingEfficiency || 0)
}

function compareByMetric(a, b, key) {
  const aValue = metricValue(a, key)
  const bValue = metricValue(b, key)
  return key === 'coa' ? aValue - bValue : bValue - aValue
}

function PoliticianRankingPanel({ isLoading = false, onSelectPolitician, politicians = [] }) {
  const [sortBy, setSortBy] = useState('efficiency')
  const [pages, setPages] = useState({ CEBU_CITY: 1, NATIONAL: 1 })
  const pageSize = 10
  const activeSortLabel = SORT_OPTIONS.find((option) => option.key === sortBy)?.label || 'Legislative Efficiency'

  const ranked = useMemo(() => {
    const priority = [sortBy, ...['efficiency', 'bills', 'projects', 'coa'].filter((metric) => metric !== sortBy)]

    return politicians
      .map((politician) => ({ ...politician, rankingEfficiency: getEfficiencyMetric(politician) }))
      .sort((a, b) => {
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
    { key: 'NATIONAL', title: 'National Ranking', rows: national },
    { key: 'CEBU_CITY', title: 'Cebu City Ranking', rows: cebuCity },
  ]

  return (
    <section className="rankingPanelWrap">
      <div className="rankingFilterBar">
        <label>
          Sort by
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPages({ CEBU_CITY: 1, NATIONAL: 1 }) }}>
            {SORT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
      </div>
      {scopes.map((scope) => (
        <article className="rankingPanel" key={scope.key}>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(scope.rows.length / pageSize))
            const currentPage = Math.min(pages[scope.key] || 1, totalPages)
            const startIndex = (currentPage - 1) * pageSize
            const pageRows = scope.rows.slice(startIndex, currentPage * pageSize)
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
                <span className="rankingMetric">{formatPercent(row.rankingEfficiency)}</span>
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
