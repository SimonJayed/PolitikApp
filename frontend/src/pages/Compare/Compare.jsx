import { useEffect, useMemo, useRef, useState } from 'react'
import { ScaleIcon } from '../../components/icons/Lucide'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { initialsFor, KpiGrid, PaginationMini, StatusLine, TimelineLedger } from '../pageHelpers'
import './Compare.css'

const PAGE_SIZE = 5
const SIDES = [
  { key: 'left', idKey: 'idA', letter: 'A' },
  { key: 'right', idKey: 'idB', letter: 'B' },
]

function Avatar({ politician, size = 'md' }) {
  return (
    <span className={`cmpAvatar ${size}`}>
      {politician?.profileImageUrl
        ? <img alt="" src={politician.profileImageUrl} />
        : initialsFor(politician?.fullName || '?')}
    </span>
  )
}

/* ---------- Selection ---------- */

function CandidateCard({ politician, letter, selected, takenBy, onSelect }) {
  const disabled = Boolean(takenBy)
  return (
    <button
      type="button"
      className={`cmpCard${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <Avatar politician={politician} />
      <span className="cmpCardBody">
        <strong>{politician.fullName}</strong>
        <small>{formatPosition(politician.position) || 'Position unavailable'}</small>
        <small>{formatJurisdiction(politician.jurisdiction) || 'Unspecified jurisdiction'}</small>
      </span>
      {selected && <span className="cmpCardTag selected">Selected as {letter}</span>}
      {disabled && <span className="cmpCardTag">Chosen as {takenBy}</span>}
    </button>
  )
}

function SelectionColumn({ side, items, totalPages, page, total, selectedId, otherId, selectedName, onPage, onSelect }) {
  const other = SIDES.find((entry) => entry.key !== side.key)
  return (
    <section className={`cmpColumn ${side.key}`} aria-label={`Candidate ${side.letter}`}>
      <header className="cmpColumnHead">
        <span className="cmpSideBadge">{side.letter}</span>
        <div className="cmpColumnTitle">
          <strong>Candidate {side.letter}</strong>
          <span>{selectedName || 'Choose a candidate'}</span>
        </div>
        <PaginationMini page={page} totalPages={totalPages} onChange={onPage} />
      </header>

      {total === 0 ? (
        <div className="cmpEmpty">No candidates match your filters.</div>
      ) : (
        <div className="cmpCardList">
          {items.map((politician) => (
            <CandidateCard
              key={`${side.key}-${politician.politicianId}`}
              politician={politician}
              letter={side.letter}
              selected={selectedId === politician.politicianId}
              takenBy={otherId === politician.politicianId ? other.letter : ''}
              onSelect={() => onSelect(selectedId === politician.politicianId ? '' : politician.politicianId)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BarSlot({ side, politician, onClear }) {
  return (
    <div className={`cmpSlot ${side.key}${politician ? ' filled' : ''}`}>
      <span className="cmpSideBadge">{side.letter}</span>
      {politician && <Avatar politician={politician} size="sm" />}
      <div className="cmpSlotText">
        <small>Candidate {side.letter}</small>
        <strong>{politician?.fullName || 'Not selected'}</strong>
      </div>
      {politician && (
        <button type="button" className="cmpSlotClear" onClick={onClear} aria-label={`Clear candidate ${side.letter}`}>×</button>
      )}
    </div>
  )
}

/* ---------- Result ---------- */

function CandidateSummary({ profile, letter }) {
  return (
    <section className={`cmpSummary ${letter === 'A' ? 'left' : 'right'}`}>
      <div className="cmpSummaryTop">
        <Avatar politician={profile} size="lg" />
        <div>
          <span className="cmpSummaryKicker">Candidate {letter} · {formatPosition(profile.position) || 'Unknown position'}</span>
          <h3>{profile.fullName}</h3>
        </div>
      </div>
      <KpiGrid profile={profile} compact />
    </section>
  )
}

function ComparisonResult({ comparison }) {
  const rows = comparison.alignedHorizontalMatrix || []
  const nameA = comparison.profileA?.fullName || 'Candidate A'
  const nameB = comparison.profileB?.fullName || 'Candidate B'
  return (
    <div className="cmpResult">
      <div className="cmpSummaryGrid">
        <CandidateSummary profile={comparison.profileA} letter="A" />
        <CandidateSummary profile={comparison.profileB} letter="B" />
      </div>

      <section className="cmpMatrix">
        <h3 className="cmpMatrixTitle">Aligned evidence ledger</h3>
        {rows.length === 0 && <div className="cmpEmpty">No aligned records to show yet.</div>}
        {rows.map((row) => (
          <div className="cmpMatrixRow" key={row.categoryTag}>
            <h4 className="cmpCategory">{row.categoryTag}</h4>
            <div className="cmpLedgerPair">
              <TimelineLedger className="comparisonLedgerCard" entries={row.recordsA || []} title={nameA} />
              <TimelineLedger className="comparisonLedgerCard" entries={row.recordsB || []} title={nameB} />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

/* ---------- Page ---------- */

export default function ComparisonPanel({ compareIds, onChange, onModalOpenChange, onSubmit, politicians, politiciansState, state }) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pages, setPages] = useState({ left: 1, right: 1 })
  const closeRef = useRef(null)
  const modalCallback = useRef(onModalOpenChange)
  modalCallback.current = onModalOpenChange

  const jurisdictions = useMemo(
    () => [...new Set(politicians.map((politician) => politician.jurisdiction).filter(Boolean))],
    [politicians],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((politician) => {
      if (jurisdictionFilter !== 'ALL' && politician.jurisdiction !== jurisdictionFilter) return false
      if (!q) return true
      return (
        politician.fullName.toLowerCase().includes(q) ||
        (politician.position || '').toLowerCase().includes(q) ||
        (formatPosition(politician.position) || '').toLowerCase().includes(q)
      )
    })
  }, [jurisdictionFilter, politicians, query])

  useEffect(() => { setPages({ left: 1, right: 1 }) }, [query, jurisdictionFilter])

  useEffect(() => {
    modalCallback.current?.(isModalOpen)
    return () => modalCallback.current?.(false)
  }, [isModalOpen])

  useEffect(() => {
    if (!isModalOpen) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') setIsModalOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isModalOpen])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = (key) => {
    const safe = Math.min(pages[key], totalPages)
    return { safe, items: filtered.slice((safe - 1) * PAGE_SIZE, safe * PAGE_SIZE) }
  }

  const byId = (id) => politicians.find((politician) => politician.politicianId === id)
  const selected = { idA: byId(compareIds.idA), idB: byId(compareIds.idB) }
  const isFiltering = Boolean(query.trim()) || jurisdictionFilter !== 'ALL'
  const isLoading = state.status === 'loading'

  function setSide(idKey, value) {
    onChange((current) => ({ ...current, [idKey]: value }))
  }

  async function submit(event) {
    const result = await onSubmit(event)
    if (result?.ok) setIsModalOpen(true)
  }

  return (
    <section className="compareShell">
      <header className="cmpHero">
        <div className="cmpHeroText">
          <h1>Compare candidates</h1>
          <p>Pick two politicians to see their records side by side.</p>
        </div>

        <div className="cmpFilters" role="search" aria-label="Candidate filters">
          <label className="cmpSearch">
            <span className="cmpSrOnly">Search candidate</span>
            <input
              name="candidateSearch"
              type="search"
              placeholder="Search by name or position"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && <button type="button" className="cmpSearchClear" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}
          </label>
          <label className="cmpSelect">
            <span className="cmpSrOnly">Jurisdiction</span>
            <select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}>
              <option value="ALL">All jurisdictions</option>
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction} value={jurisdiction}>{formatJurisdiction(jurisdiction) || jurisdiction}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <StatusLine state={state} />
      <StatusLine state={politiciansState} />

      <p className="cmpResultMeta">
        <span>{filtered.length} {filtered.length === 1 ? 'candidate' : 'candidates'}{isFiltering ? ' match your filters' : ''}</span>
        {isFiltering && (
          <button type="button" onClick={() => { setQuery(''); setJurisdictionFilter('ALL') }}>Clear filters</button>
        )}
      </p>

      <div className="cmpColumns">
        {SIDES.map((side) => {
          const other = SIDES.find((entry) => entry.key !== side.key)
          const { safe, items } = pageItems(side.key)
          return (
            <SelectionColumn
              key={side.key}
              side={side}
              items={items}
              page={safe}
              totalPages={totalPages}
              total={filtered.length}
              selectedId={compareIds[side.idKey]}
              otherId={compareIds[other.idKey]}
              selectedName={selected[side.idKey]?.fullName}
              onPage={(page) => setPages((current) => ({ ...current, [side.key]: page }))}
              onSelect={(id) => setSide(side.idKey, id)}
            />
          )
        })}
      </div>

      <form className="cmpBar" onSubmit={submit}>
        <BarSlot side={SIDES[0]} politician={selected.idA} onClear={() => setSide('idA', '')} />
        <button type="submit" className="cmpSubmit" disabled={isLoading || !compareIds.idA || !compareIds.idB}>
          <ScaleIcon size={18} />
          <span>{isLoading ? 'Comparing...' : 'Compare selected'}</span>
        </button>
        <BarSlot side={SIDES[1]} politician={selected.idB} onClear={() => setSide('idB', '')} />
      </form>

      {isModalOpen && state.data && (
        <div className="cmpBackdrop" onClick={() => setIsModalOpen(false)}>
          <section
            className="cmpModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cmp-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cmpModalHead">
              <h2 id="cmp-modal-title">Comparison result</h2>
              <button type="button" ref={closeRef} onClick={() => setIsModalOpen(false)}>Close</button>
            </header>
            <div className="cmpModalBody">
              <ComparisonResult comparison={state.data} />
            </div>
          </section>
        </div>
      )}
    </section>
  )
}