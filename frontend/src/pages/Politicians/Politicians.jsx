import { useEffect, useMemo, useState } from 'react'
import { AlertTriangleIcon, SearchIcon } from '../../components/icons/Lucide'
import { matchesJurisdiction } from '../../components/jurisdiction'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { membershipSummary, ordinal } from '../../features/congress/congressHistory'
import { chamberForPosition, congressOptions, directoryJurisdiction, matchesCongress, matchesPosition, normalizePosition, sortDirectory } from '../../features/congress/politicianDirectory'
import { useDirectory } from '../../features/congress/useDirectory'
import { formatDisplayName } from '../../features/congress/displayName'
import { initialsFor, PaginationMini, StatusLine } from '../pageHelpers'
import './Politicians.css'
import '../../components/governance/CongressMembershipSummary.css'
import PoliticianEditor from '../../components/governance/PoliticianEditor'
import WgiLeaderboard from '../../components/WgiLeaderboard'

const PAGE_SIZE = 9

export default function PoliticiansLoaderPanel({
  dbUser,
  onViewProfile,
  politicians,
  politiciansState,
  onRetry,
  state,
  onModalOpenChange,
  onPoliticianUpdate,
  onPoliticianCreate,
  token,
}) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [positionFilter, setPositionFilter] = useState('ALL')
  const [congressFilter, setCongressFilter] = useState('ALL')
  const [directoryRefresh, setDirectoryRefresh] = useState(0)
  const directory = useDirectory(directoryRefresh)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const membershipIndex = useMemo(() => new Map(directory.people.map(person => [person.politicianId, person])), [directory.people])
  const defaultPoliticians = useMemo(() => sortDirectory(
    politicians.filter(person => person.status !== 'ARCHIVED').map(person => ({ ...person, jurisdiction: directoryJurisdiction(person, membershipIndex) })),
    membershipIndex, directory.currentCongress, directory.asOfDate,
  ), [politicians, membershipIndex, directory.currentCongress, directory.asOfDate])
  const congresses = useMemo(() => congressOptions(politicians, positionFilter, membershipIndex), [politicians, positionFilter, membershipIndex])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = politicians.filter((politician) =>
      politician.status !== 'ARCHIVED' && matchesJurisdiction(directoryJurisdiction(politician, membershipIndex), jurisdictionFilter)
      && matchesPosition(politician, positionFilter, membershipIndex)
      && matchesCongress(politician, positionFilter, congressFilter, membershipIndex)
      && (!q || [politician.fullName, politician.position, membershipSummary(membershipIndex.get(politician.politicianId)?.memberships).chamber]
        .some(value => String(value || '').toLowerCase().includes(q))))
    return sortDirectory(matches, membershipIndex, directory.currentCongress, directory.asOfDate)
  }, [jurisdictionFilter, politicians, positionFilter, congressFilter, query, membershipIndex, directory.currentCongress, directory.asOfDate])

  const positions = useMemo(
    () => Array.from(new Set(['SENATOR', 'HOUSE_REPRESENTATIVE', ...politicians.filter(person => person.status !== 'ARCHIVED')
      .map(person => normalizePosition(person.position)).filter(Boolean)])).sort((left, right) => left.localeCompare(right)),
    [politicians],
  )

  useEffect(() => setPage(1), [query, jurisdictionFilter, positionFilter, congressFilter])
  useEffect(() => {
    onModalOpenChange?.(creating)
    return () => onModalOpenChange?.(false)
  }, [onModalOpenChange, creating])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const isLoading = politiciansState.status === 'loading' || directory.status === 'loading'
  const filtersActive = query.trim() !== '' || jurisdictionFilter !== 'ALL' || positionFilter !== 'ALL' || congressFilter !== 'ALL'
  const isAdmin = dbUser?.role === 'ADMIN'

  const resetFilters = () => {
    setQuery('')
    setJurisdictionFilter('ALL')
    setPositionFilter('ALL')
    setCongressFilter('ALL')
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
      <WgiLeaderboard defaultPoliticians={defaultPoliticians} onSelectPolitician={onViewProfile} />
      {creating && isAdmin && <PoliticianEditor token={token} onClose={() => setCreating(false)} onSaved={onPoliticianCreate} />}

      <div className="polBrowseHeading">
        <h2>Browse All Politicians</h2>
        <p>Search and filter politician profiles by office, Congress, or jurisdiction.</p>
      </div>
      <section className={`polFilters${chamberForPosition(positionFilter) ? ' withCongress' : ''}`} aria-label="Politician filters">
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
          <select name="dashboardPosition" onChange={(event) => { setPositionFilter(event.target.value); setCongressFilter('ALL') }} value={positionFilter}>
            <option value="ALL">All Positions</option>
            {positions.map((position) => (
              <option key={position} value={position}>{position === 'SENATOR' ? 'Senate' : position === 'HOUSE_REPRESENTATIVE' ? 'House of Representatives' : formatPosition(position)}</option>
            ))}
          </select>
        </label>

        {chamberForPosition(positionFilter) && <label className="polField">
          <span>Congress</span>
          <select name="dashboardCongress" value={congressFilter} disabled={directory.status !== 'ready'} onChange={event => setCongressFilter(event.target.value)}>
            <option value="ALL">All Congresses</option>
            {congresses.map(congress => <option key={congress} value={congress}>{ordinal(congress)} Congress</option>)}
          </select>
        </label>}

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

      {(politiciansState.status === 'error' || Boolean(directory.error)) && <div className="statusLine error" role="alert">
        <p>{politiciansState.status === 'error' ? `Politician profiles could not be loaded. ${politiciansState.message}`
          : `Congress membership filters and ordering could not be loaded. ${directory.error}`}</p>
        <button className="polReset" type="button" disabled={isLoading} onClick={() => { onRetry?.(); setDirectoryRefresh(value => value + 1) }}>Retry</button>
      </div>}
      <StatusLine state={state} />
      <div className="polResultsBar">
        <p>
          Showing <strong>{filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong>
        </p>
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

        {!isLoading && politiciansState.status !== 'error' && directory.status !== 'error' && filtered.length === 0 && (
          <div className="polEmpty">
            <SearchIcon size={28} />
            <strong>No politicians found</strong>
            <span>Try a different name, position, Congress or jurisdiction.</span>
            {filtersActive && <button type="button" onClick={resetFilters}>Reset filters</button>}
          </div>
        )}

        {!isLoading && pageItems.map((politician) => {
          const jurisdiction = directoryJurisdiction(politician, membershipIndex)
          const isNational = String(jurisdiction || '').toUpperCase().includes('NATIONAL')
          const displayName = formatDisplayName(politician.fullName)
          const membership = membershipSummary(membershipIndex.get(politician.politicianId)?.memberships)
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
                <span className="congressMembershipSummary">
                  <strong>{politician.position ? formatPosition(politician.position) : membership.chamber || 'Office information unavailable'}</strong>
                  <span>{formatJurisdiction(jurisdiction) || 'Jurisdiction unavailable'}</span>
                </span>
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
      <div className="polPagination">
        <PaginationMini page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>
    </section>
  )
}
