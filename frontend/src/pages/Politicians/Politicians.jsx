import { useEffect, useMemo, useState } from 'react'
import { AlertTriangleIcon, SearchIcon } from '../../components/icons/Lucide'
import { matchesJurisdiction } from '../../components/jurisdiction'
import { formatPosition } from '../../components/governance/positionConfig'
import CongressMembershipSummary from '../../components/governance/CongressMembershipSummary'
import { formatDisplayName } from '../../features/congress/displayName'
import { initialsFor, PaginationMini, StatusLine } from '../pageHelpers'
import './Politicians.css'
import PoliticianEditor from '../../components/governance/PoliticianEditor'

const PAGE_SIZE = 9

export default function PoliticiansLoaderPanel({
  dbUser,
  onViewProfile,
  politicians,
  politiciansState,
  state,
  onModalOpenChange,
  onPoliticianUpdate,
  onPoliticianCreate,
  token,
}) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [positionFilter, setPositionFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((politician) =>
      politician.status !== 'ARCHIVED' && matchesJurisdiction(politician.jurisdiction, jurisdictionFilter)
      && (positionFilter === 'ALL' || politician.position === positionFilter)
      && (!q || politician.fullName.toLowerCase().includes(q) || (politician.position || '').toLowerCase().includes(q)))
  }, [jurisdictionFilter, politicians, positionFilter, query])

  const positions = useMemo(
    () => Array.from(new Set(politicians.map((politician) => politician.position).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [politicians],
  )

  useEffect(() => setPage(1), [query, jurisdictionFilter, positionFilter])
  useEffect(() => {
    onModalOpenChange?.(creating)
    return () => onModalOpenChange?.(false)
  }, [onModalOpenChange, creating])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const isLoading = politiciansState.status === 'loading'
  const filtersActive = query.trim() !== '' || jurisdictionFilter !== 'ALL' || positionFilter !== 'ALL'
  const isAdmin = dbUser?.role === 'ADMIN'

  const resetFilters = () => {
    setQuery('')
    setJurisdictionFilter('ALL')
    setPositionFilter('ALL')
  }

  return (
    <section className="workspace politiciansPage">
      <header className="polHero">
        <div className="polHeroText">
          <h1>Politicians</h1>
          <p>Browse and select a politician to load their performance profile instantly.</p>
        </div>
        <div className="polHeroSide">
          <span className="polCountChip">
            <strong>{politicians.length}</strong> profile{politicians.length === 1 ? '' : 's'}
          </span>
          {isAdmin && (
            <button type="button" className="polAddButton" onClick={() => setCreating(true)}>
              + Add Politician
            </button>
          )}
        </div>
      </header>
      {creating && isAdmin && <PoliticianEditor token={token} onClose={() => setCreating(false)} onSaved={onPoliticianCreate} />}

      <section className="polFilters" aria-label="Politician filters">
        <label className="polField polSearch">
          <span>Search</span>
          <div>
            <SearchIcon size={16} />
            <input
              name="dashboardSearch"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or position"
              type="text"
              value={query}
            />
          </div>
        </label>

        <label className="polField">
          <span>Position</span>
          <select name="dashboardPosition" onChange={(event) => setPositionFilter(event.target.value)} value={positionFilter}>
            <option value="ALL">All Positions</option>
            {positions.map((position) => (
              <option key={position} value={position}>{formatPosition(position)}</option>
            ))}
          </select>
        </label>

        <label className="polField">
          <span>Jurisdiction</span>
          <select name="dashboardJurisdiction" onChange={(event) => setJurisdictionFilter(event.target.value)} value={jurisdictionFilter}>
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="CEBU_CITY">Cebu City</option>
          </select>
        </label>

        {filtersActive && (
          <button className="polReset" type="button" onClick={resetFilters}>Reset filters</button>
        )}
      </section>

      <StatusLine state={politiciansState} />
      <StatusLine state={state} />
      <div className="polResultsBar">
        <p>
          Showing <strong>{filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong>
        </p>
        <PaginationMini page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>

      <section className="polGrid" aria-label="Politicians">
        {isLoading && Array.from({ length: 6 }).map((_, index) => (
          <div className="polSkeletonCard" key={`politician-skeleton-${index}`} aria-hidden="true">
            <span className="polSkeletonAvatar" />
            <span className="polSkeletonLine wide" />
            <span className="polSkeletonLine medium" />
            <span className="polSkeletonLine short" />
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="polEmpty">
            <SearchIcon size={28} />
            <strong>No politicians found</strong>
            <span>Try a different name, position or jurisdiction.</span>
            {filtersActive && <button type="button" onClick={resetFilters}>Reset filters</button>}
          </div>
        )}

        {pageItems.map((politician) => {
          const isNational = String(politician.jurisdiction || '').toUpperCase().includes('NATIONAL')
          const displayName = formatDisplayName(politician.fullName)
          return (
            <button
              className={`polCard${isNational ? ' national' : ''}`}
              key={politician.politicianId}
              onClick={() => onViewProfile(politician.politicianId)}
              type="button"
            >
              <span className="polCardBanner" aria-hidden="true" />
              <span className="polCardAvatar">
                {politician.profileImageUrl
                  ? <img alt={politician.fullName} src={politician.profileImageUrl} />
                  : initialsFor(politician.fullName)}
              </span>

              <span className="polCardBody">
                <strong className="polName">{displayName.name}</strong>
                {displayName.needsReview && <small className="nameReviewFlag">Name formatting requires review</small>}
                <CongressMembershipSummary politicianId={politician.politicianId} />
                {politician.coaAuditDiscrepancies > 0 && (
                  <span className="polCoaChip">
                    <AlertTriangleIcon size={14} /> COA Findings ({politician.coaAuditDiscrepancies})
                  </span>
                )}
              </span>

              <span className="polCardFooter">View profile</span>
            </button>
          )
        })}
      </section>
    </section>
  )
}
