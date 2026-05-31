import { useMemo, useState } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from './icons/Lucide'
import { matchesJurisdiction } from './jurisdiction'
import { RankingRowsSkeleton } from './Skeletons'
import { computeWgiCompositeScore, formatPosition } from './module1/positionConfig'

// ─── Storage Key (persists filter across sessions) ────────────────────────────
const STORAGE_KEY = 'politikapp:rankingFilter'

function getSavedSort() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved && SORT_OPTIONS.some((o) => o.key === saved) ? saved : 'wgi'
  } catch {
    return 'wgi'
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

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

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

// ─── Sort / Metric Config ─────────────────────────────────────────────────────

/**
 * Each sort option carries:
 *   key        – internal sort key
 *   label      – filter dropdown label
 *   cardLabel  – short label shown on each ranking card
 *   getValue   – extracts the raw numeric value from a politician row
 *   format     – formats the value for display on the card
 *   title      – tooltip text for the metric cell
 *   lowerBetter – true when a lower value ranks higher (COA findings)
 */
const SORT_OPTIONS = [
  {
    key: 'wgi',
    label: 'WGI Composite Score',
    cardLabel: 'WGI',
    getValue: (p) => Number(p._wgiScore || 0),
    format: formatWgi,
    title: 'Position-Aware WGI Composite Score [0–100]',
    lowerBetter: false,
  },
  {
    key: 'bills',
    label: 'Bills / Ordinances',
    cardLabel: 'Bills',
    getValue: (p) => Number(p.billsAuthored || 0),
    format: formatCount,
    title: 'Total sponsored legislation / ordinances filed',
    lowerBetter: false,
  },
  {
    key: 'projects',
    label: 'Projects Completed',
    cardLabel: 'Projects',
    getValue: (p) => Number(p.projectCompletions || 0),
    format: formatCount,
    title: 'Total infrastructure / public projects completed',
    lowerBetter: false,
  },
  {
    key: 'budget',
    label: 'Budget Tracked',
    cardLabel: 'Budget',
    getValue: (p) => Number(p.trackedBudgetAllocated || 0),
    format: formatCurrency,
    title: 'Total tracked budget allocation (PHP)',
    lowerBetter: false,
  },
  {
    key: 'coa',
    label: 'COA Findings',
    cardLabel: 'COA',
    getValue: (p) => Number(p.coaAuditDiscrepancies || 0),
    format: formatCount,
    title: 'COA audit discrepancy count (lower is better)',
    lowerBetter: true,
  },
]

// ─── WGI Score Resolver ───────────────────────────────────────────────────────

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
  return computeWgiCompositeScore(
    politician.position,
    Number(politician.billsAuthored || 0),
    Number(politician.projectCompletions || 0),
    Number(politician.trackedBudgetAllocated || 0),
    0, // totalFlagged fallback
    Number(politician.coaAuditDiscrepancies || 0),
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

function PoliticianRankingPanel({ isLoading = false, onSelectPolitician, politicians = [] }) {
  // Persist the active sort filter in localStorage so it survives navigation
  const [sortBy, setSortBy] = useState(() => getSavedSort())
  const [pages, setPages]   = useState({ CEBU_CITY: 1, NATIONAL: 1 })
  const pageSize = 10

  const activeSortOption = SORT_OPTIONS.find((opt) => opt.key === sortBy) || SORT_OPTIONS[0]

  function handleSortChange(e) {
    const next = e.target.value
    setSortBy(next)
    setPages({ CEBU_CITY: 1, NATIONAL: 1 })
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }

  const ranked = useMemo(() => {
    // Attach pre-resolved WGI scores to avoid re-computing on each comparison
    const withScores = politicians.map((p) => ({ ...p, _wgiScore: resolveWgiScore(p) }))

    const priority = [sortBy, ...['wgi', 'bills', 'projects', 'budget', 'coa'].filter((m) => m !== sortBy)]

    return withScores.sort((a, b) => {
      for (const metric of priority) {
        const opt = SORT_OPTIONS.find((o) => o.key === metric)
        if (!opt) continue
        const aVal = opt.getValue(a)
        const bVal = opt.getValue(b)
        const diff = opt.lowerBetter ? aVal - bVal : bVal - aVal
        if (diff !== 0) return diff
      }
      return String(a.fullName || '').localeCompare(String(b.fullName || ''))
    })
  }, [politicians, sortBy])

  const national = ranked.filter((p) => matchesJurisdiction(p.jurisdiction, 'NATIONAL'))
  const cebuCity = ranked.filter((p) => matchesJurisdiction(p.jurisdiction, 'CEBU_CITY'))
  const scopes = [
    { key: 'NATIONAL',  title: 'National Ranking',  rows: national },
    { key: 'CEBU_CITY', title: 'Cebu City Ranking', rows: cebuCity },
  ]

  return (
    <section className="rankingPanelWrap">
      <div className="rankingFilterBar">
        <label>
          Sort by
          <select value={sortBy} onChange={handleSortChange}>
            {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
          </select>
        </label>
      </div>

      {scopes.map((scope) => (
        <article className="rankingPanel" key={scope.key}>
          {(() => {
            const totalPages  = Math.max(1, Math.ceil(scope.rows.length / pageSize))
            const currentPage = Math.min(pages[scope.key] || 1, totalPages)
            const startIndex  = (currentPage - 1) * pageSize
            const pageRows    = scope.rows.slice(startIndex, currentPage * pageSize)
            return (
              <>
                <header className="rankingPanelHeader">
                  <h3 className="ty-card-title">{scope.title}</h3>
                  <small className="ty-meta">Sorted by {activeSortOption.label}</small>
                </header>

                {isLoading ? (
                  <RankingRowsSkeleton rows={6} />
                ) : (
                  <div className="rankingPanelTable" role="list">
                    {scope.rows.length === 0 && <p className="emptyState">No profiles available.</p>}
                    {pageRows.map((row, index) => {
                      const primaryValue   = activeSortOption.getValue(row)
                      const primaryDisplay = activeSortOption.format(primaryValue)
                      const isCoaActive    = sortBy === 'coa'

                      return (
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
                            <small className="ty-meta">{formatPosition(row.position) || 'Position unavailable'}</small>
                          </span>

                          {/* Primary metric — reflects the active sort filter */}
                          <span
                            className={`rankingMetric${isCoaActive && primaryValue > 0 ? ' rankingMetricDanger' : ''}`}
                            title={activeSortOption.title}
                          >
                            {primaryDisplay}
                            <small style={{ fontSize: '10px', opacity: 0.65, marginLeft: '3px' }}>
                              {activeSortOption.cardLabel}
                            </small>
                          </span>

                          {/* Secondary pill: always show WGI score when not sorting by WGI */}
                          {sortBy !== 'wgi' && (
                            <span className="rankingMetricSecondary" title="WGI Composite Score">
                              {formatWgi(row._wgiScore)}
                              <small style={{ fontSize: '10px', opacity: 0.55, marginLeft: '2px' }}>WGI</small>
                            </span>
                          )}

                          {/* COA flag badge (always visible for accountability) */}
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
                      )
                    })}
                  </div>
                )}

                <nav className="paginationMini rankingPagination" aria-label={`${scope.title} pagination`}>
                  <button
                    type="button"
                    className="paginationButton"
                    disabled={currentPage <= 1}
                    onClick={() => setPages((c) => ({ ...c, [scope.key]: Math.max(1, (c[scope.key] || 1) - 1) }))}
                    aria-label={`Previous ${scope.title} page`}
                  >
                    <ArrowLeftIcon size={17} strokeWidth={2.4} />
                  </button>
                  <span className="paginationText">{currentPage} / {totalPages}</span>
                  <button
                    type="button"
                    className="paginationButton"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPages((c) => ({ ...c, [scope.key]: Math.min(totalPages, (c[scope.key] || 1) + 1) }))}
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
