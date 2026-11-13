import { useEffect, useMemo, useRef, useState } from 'react'
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
const INACTIVE_STATUSES = ['INACTIVE', 'SUSPENDED', 'ARCHIVED']
const JURISDICTION_LABELS = { NATIONAL: 'National', CEBU_CITY: 'Cebu City' }

// Active = status ACTIVE; inactive = INACTIVE / SUSPENDED / ARCHIVED.
// With no usable status, fall back to the recorded term (same rule as the profile page).
function isActiveProfile(person, today) {
  const status = String(person.status || '').toUpperCase()
  if (INACTIVE_STATUSES.includes(status)) return false
  if (status === 'ACTIVE') return true
  return !person.termEnd || person.termEnd >= today
}

function positionLabel(position) {
  if (position === 'SENATOR') return 'Senate'
  if (position === 'HOUSE_REPRESENTATIVE') return 'House of Representatives'
  return formatPosition(position)
}

// Falls back to initials when there is no photo or the photo fails to load.
function CardAvatar({ name, src }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return (
    <span className="polCardAvatar">
      {src && !failed
        ? <img alt={name} src={src} loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : initialsFor(name)}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="polSkeletonCard" aria-hidden="true">
      <span className="polSkeletonAvatar" />
      <span className="polSkeletonLine wide" />
      <span className="polSkeletonLine medium" />
      <span className="polSkeletonLine short" />
    </div>
  )
}

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
  const [activeOnly, setActiveOnly] = useState(false)
  const [directoryRefresh, setDirectoryRefresh] = useState(0)
  const directory = useDirectory(directoryRefresh)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const resultsRef = useRef(null)

  const membershipIndex = useMemo(() => new Map(directory.people.map(person => [person.politicianId, person])), [directory.people])
  const defaultPoliticians = useMemo(() => sortDirectory(
    politicians.filter(person => person.status !== 'ARCHIVED').map(person => ({ ...person, jurisdiction: directoryJurisdiction(person, membershipIndex) })),
    membershipIndex, directory.currentCongress, directory.asOfDate,
  ), [politicians, membershipIndex, directory.currentCongress, directory.asOfDate])
  const congresses = useMemo(() => congressOptions(politicians, positionFilter, membershipIndex), [politicians, positionFilter, membershipIndex])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const today = new Date().toISOString().slice(0, 10)
    const matches = politicians.filter((politician) =>
      politician.status !== 'ARCHIVED' && matchesJurisdiction(directoryJurisdiction(politician, membershipIndex), jurisdictionFilter)
      && (!activeOnly || isActiveProfile(politician, today))
      && matchesPosition(politician, positionFilter, membershipIndex)
      && matchesCongress(politician, positionFilter, congressFilter, membershipIndex)
      && (!q || [politician.fullName, politician.position, membershipSummary(membershipIndex.get(politician.politicianId)?.memberships).chamber]
        .some(value => String(value || '').toLowerCase().includes(q))))
    return sortDirectory(matches, membershipIndex, directory.currentCongress, directory.asOfDate)
  }, [jurisdictionFilter, politicians, positionFilter, congressFilter, activeOnly, query, membershipIndex, directory.currentCongress, directory.asOfDate])

  const positions = useMemo(
    () => Array.from(new Set(['SENATOR', 'HOUSE_REPRESENTATIVE', ...politicians.filter(person => person.status !== 'ARCHIVED')
      .map(person => normalizePosition(person.position)).filter(Boolean)])).sort((left, right) => left.localeCompare(right)),
    [politicians],
  )

  useEffect(() => setPage(1), [query, jurisdictionFilter, positionFilter, congressFilter, activeOnly])
  useEffect(() => {
    onModalOpenChange?.(creating)
    return () => onModalOpenChange?.(false)
  }, [onModalOpenChange, creating])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const isLoading = politiciansState.status === 'loading' || directory.status === 'loading'
  const hasError = politiciansState.status === 'error' || directory.status === 'error'
  const filtersActive = query.trim() !== '' || jurisdictionFilter !== 'ALL' || positionFilter !== 'ALL' || congressFilter !== 'ALL' || activeOnly
  const isAdmin = dbUser?.role === 'ADMIN'
  const showSkeleton = isLoading && filtered.length === 0

  const changePage = (next) => {
    setPage(next)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    resultsRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  // Removable chips so people can see, and undo, each filter that is narrowing the list.
  const activeChips = []
  if (query.trim()) activeChips.push({ key: 'query', label: `Search: “${query.trim()}”`, clear: () => setQuery('') })
  if (positionFilter !== 'ALL') activeChips.push({ key: 'position', label: positionLabel(positionFilter), clear: () => { setPositionFilter('ALL'); setCongressFilter('ALL') } })
  if (congressFilter !== 'ALL') activeChips.push({ key: 'congress', label: `${ordinal(congressFilter)} Congress`, clear: () => setCongressFilter('ALL') })
  if (jurisdictionFilter !== 'ALL') activeChips.push({ key: 'jurisdiction', label: JURISDICTION_LABELS[jurisdictionFilter] || jurisdictionFilter, clear: () => setJurisdictionFilter('ALL') })
  if (activeOnly) activeChips.push({ key: 'active', label: 'Active only', clear: () => setActiveOnly(false) })

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <section className="workspace politiciansPage">
      <header className="polHero">
        <div className="polHeroTop">
          <div className="polHeroText">
            <h1>Politicians</h1>
            <p>Browse and select a politician to load their performance profile instantly.</p>
          </div>
          <div className="polHeroSide">
            <span className="polCountChip">
              <strong>{filtersActive ? filtered.length : politicians.length}</strong>
              {filtersActive ? ` of ${politicians.length} ` : ' '}profile{politicians.length === 1 ? '' : 's'}
            </span>
            {isAdmin && (
              <button type="button" className="polAddButton" onClick={() => setCreating(true)}>
                + Add Politician
              </button>
            )}
          </div>
        </div>

        <div className={`polFilters${chamberForPosition(positionFilter) ? ' withCongress' : ''}`} role="search" aria-label="Politician filters">
          <label className="polField polSearch">
            <span>Search</span>
            <div>
              <SearchIcon size={16} />
              <input
                name="dashboardSearch"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or position"
                type="search"
                autoComplete="off"
                value={query}
              />
              {query && (
                <button className="polClear" type="button" aria-label="Clear search" onClick={() => setQuery('')}>×</button>
              )}
            </div>
          </label>

          <label className="polField">
            <span>Position</span>
            <select name="dashboardPosition" onChange={(event) => { setPositionFilter(event.target.value); setCongressFilter('ALL') }} value={positionFilter}>
              <option value="ALL">All Positions</option>
              {positions.map((position) => (
                <option key={position} value={position}>{positionLabel(position)}</option>
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

          <label className="polCheck">
            <input
              checked={activeOnly}
              name="dashboardActiveOnly"
              onChange={(event) => setActiveOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Active only</span>
          </label>

        </div>
      </header>

      <WgiLeaderboard defaultPoliticians={defaultPoliticians} onSelectPolitician={onViewProfile} />
      {creating && isAdmin && <PoliticianEditor token={token} onClose={() => setCreating(false)} onSaved={onPoliticianCreate} />}

      {(politiciansState.status === 'error' || Boolean(directory.error)) && <div className="statusLine error" role="alert">
        <p>{politiciansState.status === 'error' ? `Politician profiles could not be loaded. ${politiciansState.message}`
          : `Congress membership filters and ordering could not be loaded. ${directory.error}`}</p>
        <button className="polReset" type="button" disabled={isLoading} onClick={() => { onRetry?.(); setDirectoryRefresh(value => value + 1) }}>Retry</button>
      </div>}
      <StatusLine state={state} />

      <div className="polResultsBar" ref={resultsRef}>
        <p aria-live="polite">
          {isLoading && filtered.length === 0 ? 'Loading politicians…' : <>
            Showing <strong>{rangeStart}–{rangeEnd}</strong> of <strong>{filtered.length}</strong>
          </>}
        </p>
        {activeChips.length > 0 && (
          <ul className="polChips" aria-label="Active filters">
            {activeChips.map(chip => (
              <li key={chip.key}>
                <button className="polChip" type="button" onClick={chip.clear} aria-label={`Remove filter: ${chip.label}`}>
                  <span>{chip.label}</span>
                  <i aria-hidden="true">×</i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="polGrid" aria-label="Politicians" aria-busy={isLoading}>
        {showSkeleton && Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)}

        {!isLoading && !hasError && filtered.length === 0 && (
          <div className="polEmpty">
            <SearchIcon size={28} />
            <strong>No politicians found</strong>
            <span>Try a different name, position, Congress or jurisdiction.</span>
          </div>
        )}

        {pageItems.map((politician) => {
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
              <CardAvatar name={politician.fullName} src={politician.profileImageUrl} />

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

              <span className="polCardFooter">View profile <i aria-hidden="true">›</i></span>
            </button>
          )
        })}
      </section>
      {totalPages > 1 && (
        <div className="polPagination">
          <PaginationMini page={safePage} totalPages={totalPages} onChange={changePage} />
        </div>
      )}
    </section>
  )
}