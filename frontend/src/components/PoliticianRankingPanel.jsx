import { AlertTriangleIcon } from './icons/Lucide'

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

function PoliticianRankingPanel({ onSelectPolitician, politicians = [] }) {
  const ranked = politicians
    .map((politician) => ({ ...politician, rankingEfficiency: getEfficiencyMetric(politician) }))
    .sort((a, b) => b.rankingEfficiency - a.rankingEfficiency)

  const national = ranked.filter((p) => p.jurisdiction === 'NATIONAL')
  const cebuCity = ranked.filter((p) => p.jurisdiction === 'CEBU_CITY')
  const scopes = [
    { key: 'NATIONAL', title: 'National Ranking', rows: national },
    { key: 'CEBU_CITY', title: 'Cebu City Ranking', rows: cebuCity },
  ]

  return (
    <section className="rankingPanelWrap">
      {scopes.map((scope) => (
        <article className="rankingPanel" key={scope.key}>
          <header className="rankingPanelHeader">
            <h3 className="ty-card-title">{scope.title}</h3>
            <small className="ty-meta">Sorted by legislative efficiency</small>
          </header>
          <div className="rankingPanelTable" role="list">
            {scope.rows.length === 0 && <p className="emptyState">No profiles available.</p>}
            {scope.rows.map((row, index) => (
              <button
                className="rankingRow"
                key={row.politicianId}
                onClick={() => onSelectPolitician?.(row.politicianId)}
                role="listitem"
                type="button"
              >
                <span className="rankingRank">#{index + 1}</span>
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
        </article>
      ))}
    </section>
  )
}

export default PoliticianRankingPanel
