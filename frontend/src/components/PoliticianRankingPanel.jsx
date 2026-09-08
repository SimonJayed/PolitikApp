import { useMemo, useState } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from './icons/Lucide'
import { matchesJurisdiction } from './jurisdiction'
import { RankingRowsSkeleton } from './Skeletons'
import { computeWgiCompositeScore, formatPosition } from './module1/positionConfig'

const STORAGE_KEY = 'politikapp:rankingFilter'

function getSavedSort() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved && SORT_OPTIONS.some((o) => o.key === saved) ? saved : 'wgi'
  } catch {
    return 'wgi'
  }
}

function formatDecimal(value) {
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

const SORT_OPTIONS = [
  {
    key: 'wgi',
    label: 'WGI Composite Score',
    cardLabel: 'WGI',
    getValue: (p) => Number(p._wgiScore || 0),
    format: formatDecimal,
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
    format: formatDecimal,
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

function resolveWgiScore(politician) {
  if (Number.isFinite(Number(politician.wgiCompositeScore)) && Number(politician.wgiCompositeScore) > 0) {
    return Number(politician.wgiCompositeScore)
  }
  return computeWgiCompositeScore(
    politician.position,
    Number(politician.billsAuthored || 0),
    Number(politician.projectCompletions || 0),
    Number(politician.trackedBudgetAllocated || 0),
    0,
    Number(politician.coaAuditDiscrepancies || 0),
  )
}

function PoliticianRankingPanel({ isLoading = false, onSelectPolitician, politicians = [] }) {
  const [sortBy, setSortBy] = useState(() => getSavedSort())
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [officeFilter, setOfficeFilter] = useState('ALL')
  const [pages, setPages] = useState({ CEBU_CITY: 1, NATIONAL: 1 })
  const pageSize = 10

  const activeSortOption = SORT_OPTIONS.find((opt) => opt.key === sortBy) || SORT_OPTIONS[0]

  const officeOptions = useMemo(() => {
    return Array.from(new Set(politicians.map((p) => p.position).filter(Boolean))).sort()
  }, [politicians])

  function handleSortChange(e) {
    const next = e.target.value
    setSortBy(next)
    setPages({ CEBU_CITY: 1, NATIONAL: 1 })
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }

  const ranked = useMemo(() => {
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

  const filteredRanked = useMemo(() => {
    return ranked.filter((p) => {
      if (officeFilter !== 'ALL' && p.position !== officeFilter) {
        return false
      }
      return true
    })
  }, [ranked, officeFilter])

  const national = filteredRanked.filter((p) => matchesJurisdiction(p.jurisdiction, 'NATIONAL'))
  const cebuCity = filteredRanked.filter((p) => matchesJurisdiction(p.jurisdiction, 'CEBU_CITY'))

  const scopes = useMemo(() => {
    const list = []
    if (jurisdictionFilter === 'ALL' || jurisdictionFilter === 'NATIONAL') {
      list.push({ key: 'NATIONAL', title: 'National Officials Ranking', rows: national })
    }
    if (jurisdictionFilter === 'ALL' || jurisdictionFilter === 'CEBU_CITY') {
      list.push({ key: 'CEBU_CITY', title: 'Cebu City Officials Ranking', rows: cebuCity })
    }
    return list
  }, [jurisdictionFilter, national, cebuCity])

  return (
    <section className="rankingPanelWrap">
      <div className="rankingFilterBar" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Jurisdiction
          <select
            id="ranking-jurisdiction-filter"
            value={jurisdictionFilter}
            onChange={(e) => {
              setJurisdictionFilter(e.target.value)
              setPages({ CEBU_CITY: 1, NATIONAL: 1 })
            }}
          >
            <option value="ALL">All Jurisdictions</option>
            <option value="NATIONAL">National</option>
            <option value="CEBU_CITY">Cebu City</option>
          </select>
        </label>

        <label>
          Office Type
          <select
            id="ranking-office-filter"
            value={officeFilter}
            onChange={(e) => {
              setOfficeFilter(e.target.value)
              setPages({ CEBU_CITY: 1, NATIONAL: 1 })
            }}
          >
            <option value="ALL">All Office Types</option>
            {officeOptions.map((pos) => (
              <option key={pos} value={pos}>{formatPosition(pos)}</option>
            ))}
          </select>
        </label>

        <label>
          Sort by
          <select id="ranking-sort-filter" value={sortBy} onChange={handleSortChange}>
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

                          <span
                            className={`rankingMetric${isCoaActive && primaryValue > 0 ? ' rankingMetricDanger' : ''}`}
                            title={activeSortOption.title}
                          >
                            {primaryDisplay}
                            <small style={{ fontSize: '10px', opacity: 0.65, marginLeft: '3px' }}>
                              {activeSortOption.cardLabel}
                            </small>
                          </span>

                          {sortBy !== 'wgi' && (
                            <span className="rankingMetricSecondary" title="WGI Composite Score">
                              {formatDecimal(row._wgiScore)}
                              <small style={{ fontSize: '10px', opacity: 0.55, marginLeft: '2px' }}>WGI</small>
                            </span>
                          )}

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
