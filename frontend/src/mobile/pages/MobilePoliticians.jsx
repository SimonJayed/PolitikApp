import { useEffect, useId, useMemo, useState } from 'react'
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon } from '../../components/icons/Lucide'
import { matchesJurisdiction } from '../../components/jurisdiction'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { membershipSummary, ordinal } from '../../features/congress/congressHistory'
import {
  congressOptions,
  directoryJurisdiction,
  directoryPositions,
  matchesBranch,
  matchesCongress,
  matchesDirectoryName,
  matchesPosition,
  sortDirectory,
} from '../../features/congress/politicianDirectory'
import { useDirectory } from '../../features/congress/useDirectory'
import { formatDisplayName } from '../../features/congress/displayName'
import { formatWgiScore } from '../../features/congress/wgiLeaderboard'
import { useLeaderboardFirstPage } from '../../features/congress/leaderboardReads'
import MobileBottomSheet from '../components/layout/MobileBottomSheet'
import MobileLeaderboardPodium from '../components/cards/MobileLeaderboardPodium'

const PAGE_SIZE = 10
const INACTIVE_STATUSES = ['INACTIVE', 'SUSPENDED', 'ARCHIVED']

function isActiveProfile(person, today) {
  const status = String(person.status || '').toUpperCase()
  if (INACTIVE_STATUSES.includes(status)) return false
  if (status === 'ACTIVE') return true
  return !person.termEnd || person.termEnd >= today
}

export function MobilePoliticians({
  politicians = [],
  politiciansState = {},
  onViewProfile,
  onCompareToggle,
  compareIds = [],
  dbUser,
}) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [positionFilter, setPositionFilter] = useState('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [congressFilter, setCongressFilter] = useState('ALL')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const positionFilterId = useId()

  const directory = useDirectory(0)
  const leaderboard = useLeaderboardFirstPage()

  const membershipIndex = useMemo(
    () => new Map(directory.people.map((person) => [person.politicianId, person])),
    [directory.people]
  )

  const branchPeople = useMemo(
    () => politicians.filter(person => matchesBranch(person, branchFilter, membershipIndex)),
    [politicians, branchFilter, membershipIndex]
  )
  const congresses = useMemo(() => congressOptions(branchPeople, positionFilter, membershipIndex),
    [branchPeople, positionFilter, membershipIndex])

  const positions = useMemo(
    () => directoryPositions(branchPeople, membershipIndex),
    [branchPeople, membershipIndex]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const today = new Date().toISOString().slice(0, 10)
    const matches = branchPeople.filter(
      (politician) =>
        politician.status !== 'ARCHIVED' &&
        matchesJurisdiction(directoryJurisdiction(politician, membershipIndex), jurisdictionFilter) &&
        (!activeOnly || isActiveProfile(politician, today)) &&
        matchesPosition(politician, positionFilter, membershipIndex) &&
        matchesCongress(politician, positionFilter, congressFilter, membershipIndex) &&
        (matchesDirectoryName(politician, query, membershipIndex) ||
          [
            politician.fullName,
            politician.position,
            formatPosition(politician.position),
            membershipSummary(membershipIndex.get(politician.politicianId)?.memberships).chamber,
          ].some((val) => String(val || '').toLowerCase().includes(q)))
    )
    return sortDirectory(matches, membershipIndex, directory.currentCongress, directory.asOfDate)
  }, [
    jurisdictionFilter,
    branchPeople,
    positionFilter,
    congressFilter,
    activeOnly,
    query,
    membershipIndex,
    directory.currentCongress,
    directory.asOfDate,
  ])

  useEffect(() => {
    setPage(1)
  }, [query, branchFilter, jurisdictionFilter, positionFilter, congressFilter, activeOnly])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasActiveFilters =
    branchFilter !== 'ALL' || jurisdictionFilter !== 'ALL' || positionFilter !== 'ALL' || congressFilter !== 'ALL' || activeOnly

  return (
    <div style={{ paddingBottom: '24px' }}>
      {/* Top 3 Podium Cards */}
      <MobileLeaderboardPodium
        entries={leaderboard.entries}
        onSelectPolitician={onViewProfile}
      />

      {/* Search Bar & Filter Button */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <div style={{
          position: 'relative',
          flex: '1 1 auto',
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
        }}>
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94A3B8',
            display: 'flex',
          }}>
            <SearchIcon size={18} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search politicians, roles..."
            aria-label="Search politicians"
            style={{
              width: '100%',
              height: '48px',
              paddingLeft: '40px',
              paddingRight: '12px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#0F172A',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          className="mobileTouchTarget"
          aria-label="Filter politicians"
          style={{
            background: hasActiveFilters ? '#122a58' : 'var(--bg-surface, #ffffff)',
            color: hasActiveFilters ? '#ffffff' : '#475569',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '12px',
            padding: '0 14px',
            fontWeight: 600,
            fontSize: '0.8125rem',
            flexShrink: 0,
          }}
        >
          Filters {hasActiveFilters && '•'}
        </button>
      </div>

      {/* Results Count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.8125rem',
        color: '#64748B',
        marginBottom: '10px',
        padding: '0 4px',
      }}>
        <span>{filtered.length} public officials</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setBranchFilter('ALL')
              setJurisdictionFilter('ALL')
              setPositionFilter('ALL')
              setCongressFilter('ALL')
              setActiveOnly(false)
              setQuery('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#EF4444',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Politician List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {pageItems.length === 0 ? (
          <div className="mobileCard" style={{ textAlign: 'center', padding: '36px 16px' }}>
            <p style={{ margin: 0, color: '#64748B', fontWeight: 500 }}>
              No officials matched your search criteria.
            </p>
          </div>
        ) : (
          pageItems.map((person) => {
            const jurisdiction = directoryJurisdiction(person, membershipIndex)
            const positionTag = formatPosition(person.position)

            return (
              <div
                key={person.politicianId}
                className="mobileCard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  margin: 0,
                }}
              >
                {/* Avatar */}
                <div
                  onClick={() => onViewProfile?.(person.politicianId)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: '#475569',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  {person.profileImageUrl ? (
                    <img
                      src={person.profileImageUrl}
                      alt={person.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    String(person.fullName || '').slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Details */}
                <div
                  onClick={() => onViewProfile?.(person.politicianId)}
                  style={{ flex: '1 1 auto', minWidth: 0, cursor: 'pointer' }}
                >
                  <h3 style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {formatDisplayName(person.fullName).name}
                  </h3>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '2px',
                    fontSize: '0.75rem',
                    color: '#64748B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    <span>{positionTag || 'Official'}</span>
                    {jurisdiction && <span>· {formatJurisdiction(jurisdiction)}</span>}
                  </div>
                </div>

                {/* WGI Score or Action */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => onViewProfile?.(person.politicianId)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontSize: '0.9375rem',
                      fontWeight: 800,
                      color: '#1E40AF',
                    }}>
                      {formatWgiScore(person.wgiCompositeScore ?? person.wgiScore ?? person.overallScore)}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: '#94A3B8' }}>
                      WGI Score
                    </span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '20px',
        }}>
          <button
            type="button"
            className="mobileTouchTarget"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
            style={{
              background: 'var(--bg-surface, #ffffff)',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              opacity: safePage <= 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeftIcon size={20} />
          </button>

          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            className="mobileTouchTarget"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
            style={{
              background: 'var(--bg-surface, #ffffff)',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              opacity: safePage >= totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>
      )}

      {/* Filter Bottom Sheet */}
      <MobileBottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter Public Officials"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
            Branch
            <select value={branchFilter} onChange={event => {
              setBranchFilter(event.target.value)
              setPositionFilter('ALL')
              setCongressFilter('ALL')
              setJurisdictionFilter('ALL')
            }} style={{ minHeight: '48px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px' }}>
              <option value="ALL">All Branches</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="LEGISLATIVE">Legislative</option>
            </select>
          </label>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
              Jurisdiction
            </label>
            <select
              value={jurisdictionFilter}
              onChange={(e) => setJurisdictionFilter(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                background: '#FFFFFF',
                color: '#0F172A',
              }}
            >
              <option value="ALL">All Jurisdictions</option>
              <option value="NATIONAL">National</option>
              <option value="CEBU_CITY">Cebu City</option>
            </select>
          </div>

          <div>
            <label htmlFor={positionFilterId} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
              Position / Office
            </label>
            <select
              id={positionFilterId}
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value)
                setCongressFilter('ALL')
              }}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                background: '#FFFFFF',
                color: '#0F172A',
              }}
            >
              <option value="ALL">All Positions</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {formatPosition(pos)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
              Congress Term
            </label>
            <select
              value={congressFilter}
              disabled={congresses.length === 0}
              onChange={(e) => setCongressFilter(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                background: '#FFFFFF',
                color: '#0F172A',
              }}
            >
              <option value="ALL">All Terms</option>
              {congresses.map((congress) => (
                <option key={congress} value={congress}>
                  {ordinal(congress)} Congress
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px' }}>
            <input
              type="checkbox"
              id="activeOnlyMobile"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              style={{ width: '20px', height: '20px' }}
            />
            <label htmlFor="activeOnlyMobile" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              Show currently active officials only
            </label>
          </div>

          <button
            type="button"
            className="mobileCardAction"
            onClick={() => setFilterSheetOpen(false)}
            style={{
              background: '#122a58',
              color: '#ffffff',
              width: '100%',
              marginTop: '12px',
            }}
          >
            Apply Filters
          </button>
        </div>
      </MobileBottomSheet>
    </div>
  )
}

export default MobilePoliticians

