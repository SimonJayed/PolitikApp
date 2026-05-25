import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import './App.css'
import ModerationPanel from './components/ModerationPanel'
import { DeveloperSandboxProvider, useDeveloperSandbox } from './developer/DeveloperSandboxContext'
import DeveloperOptionsPanel from './developer/DeveloperOptionsPanel'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const SOURCE_URL_PATTERN = /^https?:\/\/([a-zA-Z0-9-]+\.)*(gov\.ph|edu\.ph)(\/.*)?$/

const emptySubmission = {
  politicianId: '',
  contributorId: '',
  sourceUrl: '',
  categoryTag: 'Audit',
  actionIdentifier: 'COA_FINDING',
  quantitativeMetric: '',
  impactSummary: '',
}

const actionOptions = [
  'COA_FINDING',
  'BUDGET_ALLOCATION',
  'PROJECT_COMPLETION',
  'SPONSORED_LEGISLATION',
]

const categoryOptions = ['Audit', 'Finance', 'Infrastructure', 'Healthcare', 'Education']
async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || `Request failed with status ${response.status}`)
  }
  return body
}

function AppInner() {
  const sandboxContext = useDeveloperSandbox()
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null
  const currentRole = isDevModeActive && manipulatedUser ? manipulatedUser.role : 'JUDICIAL_REVIEWER'

  const [activeView, setActiveView] = useState('directory')
  const [politiciansState, setPoliticiansState] = useState({
    data: [],
    message: '',
    selected: null,
    status: 'idle',
  })
  const [searchName, setSearchName] = useState('')
  const [importState, setImportState] = useState({ status: 'idle', message: '' })
  const [formData, setFormData] = useState(emptySubmission)
  const [submissionState, setSubmissionState] = useState({ status: 'idle', message: '' })
  const [dashboardId, setDashboardId] = useState('')
  const [dashboardState, setDashboardState] = useState({ status: 'idle', message: '', data: null })
  const [compareIds, setCompareIds] = useState({ idA: '', idB: '' })
  const [comparisonState, setComparisonState] = useState({ status: 'idle', message: '', data: null })

  const isSourceAllowed = useMemo(
    () => SOURCE_URL_PATTERN.test(formData.sourceUrl.trim()),
    [formData.sourceUrl],
  )

  const loadPoliticians = useCallback(async () => {
    setPoliticiansState((current) => ({ ...current, message: 'Loading politicians...', status: 'loading' }))
    try {
      const data = await fetch(`${API_BASE_URL}/api/politicians`).then(readApiResponse)
      setPoliticiansState({ data, message: '', selected: data[0] || null, status: 'success' })
    } catch (error) {
      setPoliticiansState({ data: [], message: error.message, selected: null, status: 'error' })
    }
  }, [])

  useEffect(() => {
    loadPoliticians()
  }, [loadPoliticians])

  async function handleSearch(event) {
    event.preventDefault()
    const endpoint = searchName.trim()
      ? `${API_BASE_URL}/api/politicians/search?${new URLSearchParams({ name: searchName.trim() })}`
      : `${API_BASE_URL}/api/politicians`

    setPoliticiansState((current) => ({ ...current, message: 'Searching politicians...', status: 'loading' }))
    try {
      const data = await fetch(endpoint).then(readApiResponse)
      setPoliticiansState({ data, message: '', selected: data[0] || null, status: 'success' })
    } catch (error) {
      setPoliticiansState({ data: [], message: error.message, selected: null, status: 'error' })
    }
  }

  async function handleImport() {
    setImportState({ status: 'loading', message: 'Importing from Wikidata...' })
    try {
      const data = await fetch(`${API_BASE_URL}/api/import/wikidata/politicians`, {
        method: 'POST',
      }).then(readApiResponse)
      setImportState({
        status: 'success',
        message: `${data.importedCount} politicians imported or updated.`,
      })
      await loadPoliticians()
    } catch (error) {
      setImportState({ status: 'error', message: error.message })
    }
  }

  async function handleSelectPolitician(politicianId) {
    setPoliticiansState((current) => ({ ...current, message: 'Loading profile...', status: 'loading' }))
    try {
      const selected = await fetch(`${API_BASE_URL}/api/politicians/${politicianId}`).then(readApiResponse)
      setPoliticiansState((current) => ({ ...current, message: '', selected, status: 'success' }))
    } catch (error) {
      setPoliticiansState((current) => ({ ...current, message: error.message, status: 'error' }))
    }
  }

  function updateFormField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmission(event) {
    event.preventDefault()
    if (!isSourceAllowed) {
      setSubmissionState({
        status: 'error',
        message: 'Source URL must resolve to an approved .gov.ph or .edu.ph domain.',
      })
      return
    }

    setSubmissionState({ status: 'loading', message: 'Submitting evidence record...' })
    try {
      const payload = {
        ...formData,
        sourceUrl: formData.sourceUrl.trim(),
        quantitativeMetric: Number(formData.quantitativeMetric),
      }
      const data = await fetch(`${API_BASE_URL}/api/submissions`, {
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }).then(readApiResponse)

      setFormData(emptySubmission)
      setSubmissionState({ status: 'success', message: data.message || 'Submission queued.' })
    } catch (error) {
      setSubmissionState({ status: 'error', message: error.message })
    }
  }

  async function handleDashboardLookup(event) {
    event.preventDefault()
    await loadDashboardById(dashboardId.trim())
  }

  async function loadDashboardById(politicianId) {
    if (!politicianId) {
      setDashboardState({ status: 'error', message: 'Select a politician first.', data: null })
      return { ok: false }
    }

    setDashboardState({ status: 'loading', message: 'Loading dashboard...', data: null })
    try {
      const data = await fetch(
        `${API_BASE_URL}/api/politicians/${politicianId}/dashboard`,
      ).then(readApiResponse)
      setDashboardState({ status: 'success', message: '', data })
      return { ok: true, data }
    } catch (error) {
      setDashboardState({ status: 'error', message: error.message, data: null })
      return { ok: false, error }
    }
  }

  function handlePoliticianLocalUpdate(politicianId, updates) {
    setPoliticiansState((current) => {
      const nextData = current.data.map((politician) =>
        politician.politicianId === politicianId ? { ...politician, ...updates } : politician,
      )
      const nextSelected =
        current.selected && current.selected.politicianId === politicianId
          ? { ...current.selected, ...updates }
          : current.selected
      return { ...current, data: nextData, selected: nextSelected }
    })

    setDashboardState((current) => {
      if (!current.data || current.data.politicianId !== politicianId) {
        return current
      }
      return { ...current, data: { ...current.data, ...updates } }
    })
  }

  async function handleComparisonLookup(event) {
    event.preventDefault()
    const params = new URLSearchParams({
      idA: compareIds.idA.trim(),
      idB: compareIds.idB.trim(),
    })
    setComparisonState({ status: 'loading', message: 'Building comparison...', data: null })
    try {
      const data = await fetch(`${API_BASE_URL}/api/politicians/compare?${params}`).then(
        readApiResponse,
      )
      setComparisonState({ status: 'success', message: '', data })
      return { ok: true, data }
    } catch (error) {
      setComparisonState({ status: 'error', message: error.message, data: null })
      return { ok: false, error }
    }
  }

  return (
    <main className="appShell">
      <Sidebar activeView={activeView} onSelectView={setActiveView} title="PolitikApp" />

      <section className="pageContent">
        <header className="topBar">
          <div>
            <p className="eyebrow">{activeView === 'moderation' ? 'Module 2' : 'Module 1'}</p>
            <h1>{activeView === 'moderation' ? 'Judicial Moderation Engine' : 'Source-First Profile Aggregator'}</h1>
          </div>
        </header>

        {activeView === 'directory' && (
          <PoliticianDirectory
            importState={importState}
            onImport={handleImport}
            onRefresh={loadPoliticians}
            onSearch={handleSearch}
            onSelect={handleSelectPolitician}
            politicians={politiciansState.data}
            searchName={searchName}
            selectedPolitician={politiciansState.selected}
            setSearchName={setSearchName}
            state={politiciansState}
          />
        )}

        {activeView === 'submit' && (
          <SubmissionPanel
            formData={formData}
            isSourceAllowed={isSourceAllowed}
            onChange={updateFormField}
            onSubmit={handleSubmission}
            state={submissionState}
          />
        )}

        {activeView === 'dashboard' && (
          <DashboardPanel
            dashboardId={dashboardId}
            onChange={setDashboardId}
            onLoadById={loadDashboardById}
            onPoliticianUpdate={handlePoliticianLocalUpdate}
            onSubmit={handleDashboardLookup}
            politicians={politiciansState.data}
            politiciansState={politiciansState}
            state={dashboardState}
          />
        )}

        {activeView === 'compare' && (
          <ComparisonPanel
            compareIds={compareIds}
            onChange={setCompareIds}
            onSubmit={handleComparisonLookup}
            politicians={politiciansState.data}
            politiciansState={politiciansState}
            state={comparisonState}
          />
        )}

        {activeView === 'moderation' && (
          currentRole === 'CONTRIBUTOR' ? (
            <section className="workspace" style={{ textAlign: 'center', padding: '40px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h2 style={{ color: '#dc2626', fontSize: '24px', margin: '0 0 12px 0' }}>🛑 Access Restricted</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '15px', lineHeight: '1.5' }}>
                Contributor accounts do not have authorized clearance to view or moderate pending queue cards.
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '14px', fontStyle: 'italic' }}>
                *Presentation Note: Open the floating user profile drawer spoofer to reset your Session Role Override back to JUDICIAL_REVIEWER.*
              </p>
            </section>
          ) : (
            <ModerationPanel />
          )
        )}
      </section>
    </main>
  )
}

function App() {
  return (
    <DeveloperSandboxProvider>
      <AppInner />
      <DeveloperOptionsPanel />
    </DeveloperSandboxProvider>
  )
}

function PoliticianDirectory({
  importState,
  onImport,
  onRefresh,
  onSearch,
  onSelect,
  politicians,
  searchName,
  selectedPolitician,
  setSearchName,
  state,
}) {
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')

  const filteredPoliticians = useMemo(() => {
    return politicians.filter((politician) => {
      return (
        jurisdictionFilter === 'ALL' ||
        politician.jurisdiction === jurisdictionFilter
      )
    })
  }, [jurisdictionFilter, politicians])

  const sortedPoliticians = [...filteredPoliticians].sort(
    (a, b) => (b.efficiencyRatio || 0) - (a.efficiencyRatio || 0)
  )

  return (
    <section className="workspace directoryWorkspace">
      <section className="directoryToolbar">
        <form className="searchBar" onSubmit={onSearch}>
          <Field
            label="Search by name"
            name="searchName"
            onChange={(event) => setSearchName(event.target.value)}
            required={false}
            value={searchName}
          />
          <label>
            Jurisdiction
            <select
              name="directoryJurisdiction"
              onChange={(event) => setJurisdictionFilter(event.target.value)}
              value={jurisdictionFilter}
            >
              <option value="ALL">All</option>
              <option value="NATIONAL">National</option>
              <option value="CEBU_CITY">Cebu City</option>
            </select>
          </label>
          <button disabled={state.status === 'loading'} type="submit">
            Search
          </button>
          <button onClick={onRefresh} type="button">
            Refresh
          </button>
        </form>
        <button disabled={importState.status === 'loading'} onClick={onImport} type="button">
          Import Wikidata
        </button>
      </section>

      <StatusLine state={importState} />
      <StatusLine state={state} />

      <div className="directoryGrid">
        <section className="politicianList" aria-label="Politicians">
          {sortedPoliticians.length === 0 && <p className="emptyState">No politicians found.</p>}
          {sortedPoliticians.map((politician, index) => (
            <button
              className={
                selectedPolitician?.politicianId === politician.politicianId
                  ? 'politicianRow active'
                  : 'politicianRow'
              }
              key={politician.politicianId}
              onClick={() => onSelect(politician.politicianId)}
              type="button"
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', minHeight: 'auto', padding: '12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>{politician.fullName}</span>
                <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Rank #{index + 1}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <small style={{ color: '#6b7280' }}>{politician.position || 'UNKNOWN'}</small>
                <small style={{ color: '#059669', fontWeight: 'bold' }}>
                  Eff: {Number(politician.efficiencyRatio || 0).toFixed(1)}%
                </small>
              </div>
              {politician.coaAuditDiscrepancies > 0 && (
                <div style={{ alignSelf: 'flex-start', background: '#fef3c7', color: '#d97706', border: '1px solid #f59e0b', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                  ⚠️ COA Findings Flagged ({politician.coaAuditDiscrepancies})
                </div>
              )}
            </button>
          ))}
        </section>

        {selectedPolitician ? (
          <PoliticianProfile politician={selectedPolitician} />
        ) : (
          <section className="profileSummary">
            <p className="emptyState">Select a politician to view profile details.</p>
          </section>
        )}
      </div>
    </section>
  )
}

function PoliticianProfile({ politician }) {
  return (
    <section className="importedProfile" style={{ position: 'relative' }}>
      {politician.coaAuditDiscrepancies > 0 && (
        <div 
          className="coa-alert-badge"
          style={{ 
            background: '#fffbeb', 
            color: '#b45309', 
            border: '1px solid #f59e0b', 
            padding: '10px 16px', 
            borderRadius: '8px', 
            fontSize: '13px', 
            fontWeight: 'bold', 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          ⚠️ HIGH ACCOUNTABILITY WARNING: COA Audit Discrepancies Flagged ({politician.coaAuditDiscrepancies} instances resolved in public ledger).
        </div>
      )}

      <div className="profileHero">
        <div className="portraitFrame">
          {politician.profileImageUrl ? (
            <img alt={politician.fullName} src={politician.profileImageUrl} />
          ) : (
            <span>{initialsFor(politician.fullName)}</span>
          )}
        </div>
        <div>
          <p className="eyebrow">{politician.position || 'UNKNOWN'}</p>
          <h2>{politician.fullName}</h2>
          <p>{politician.jurisdiction}</p>
          <p>{politician.partyAffiliation || 'Party affiliation unavailable'}</p>
        </div>
      </div>

      <div className="profileFacts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
        <Fact label="Status" value={politician.status} />
        <Fact label="Term start" value={formatDate(politician.termStart)} />
        <Fact label="Term end" value={formatDate(politician.termEnd)} />
        <Fact label="Legislative Efficiency" value={`${Number(politician.efficiencyRatio || 0).toFixed(1)}%`} />
        <Fact label="COA Discrepancies" value={`${politician.coaAuditDiscrepancies || 0}`} />
        <Fact label="Tracked Budget Allocated" value={formatCurrency(politician.trackedBudgetAllocated)} />
      </div>

      <section className="biographyBlock" style={{ marginTop: '20px' }}>
        <h2>Biography</h2>
        <p>{politician.biography || 'No Wikipedia summary was returned for this profile.'}</p>
      </section>
    </section>
  )
}

function SubmissionPanel({ formData, isSourceAllowed, onChange, onSubmit, state }) {
  return (
    <section className="workspace">
      <form className="editorPanel" onSubmit={onSubmit}>
        <Field label="Politician ID" name="politicianId" value={formData.politicianId} onChange={onChange} />
        <Field label="Contributor ID" name="contributorId" value={formData.contributorId} onChange={onChange} />
        <Field label="Source URL" name="sourceUrl" value={formData.sourceUrl} onChange={onChange} />
        <div className="fieldRow">
          <label>
            Category
            <select name="categoryTag" value={formData.categoryTag} onChange={onChange}>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select name="actionIdentifier" value={formData.actionIdentifier} onChange={onChange}>
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Field
          label="Quantitative Metric"
          name="quantitativeMetric"
          onChange={onChange}
          type="number"
          value={formData.quantitativeMetric}
        />
        <label>
          Impact Summary
          <textarea name="impactSummary" required rows="5" value={formData.impactSummary} onChange={onChange} />
        </label>
        <div className="formFooter">
          <span className={isSourceAllowed ? 'sourceBadge approved' : 'sourceBadge'}>
            {isSourceAllowed ? 'Approved source' : 'Awaiting approved source'}
          </span>
          <button disabled={state.status === 'loading'} type="submit">
            Submit
          </button>
        </div>
        <StatusLine state={state} />
      </form>
    </section>
  )
}

function DashboardPanel({
  dashboardId,
  onChange,
  onLoadById,
  onPoliticianUpdate,
  onSubmit,
  politicians,
  politiciansState,
  state,
}) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [detailsData, setDetailsData] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({
    biography: '',
    fullName: '',
    jurisdiction: '',
    partyAffiliation: '',
    position: '',
    profileImageUrl: '',
  })

  const filteredPoliticians = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return politicians.filter((politician) => {
      const matchesJurisdiction =
        jurisdictionFilter === 'ALL' || politician.jurisdiction === jurisdictionFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        politician.fullName.toLowerCase().includes(normalizedQuery) ||
        (politician.position || '').toLowerCase().includes(normalizedQuery)
      return matchesJurisdiction && matchesQuery
    })
  }, [jurisdictionFilter, politicians, query])

  useEffect(() => {
    if (!isDetailsOpen && !isEditOpen) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsEditOpen(false)
        setIsDetailsOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isDetailsOpen, isEditOpen])

  async function handleCardSelect(politician) {
    const politicianId = politician.politicianId
    onChange(politicianId)
    const result = await onLoadById(politicianId)
    setDetailsData(result?.ok ? result.data : politician)
    setIsDetailsOpen(true)
  }

  function openEditModal() {
    if (!detailsData) {
      return
    }
    setEditErrors({})
    setEditForm({
      biography: detailsData.biography || '',
      fullName: detailsData.fullName || '',
      jurisdiction: detailsData.jurisdiction || '',
      partyAffiliation: detailsData.partyAffiliation || '',
      position: detailsData.position || '',
      profileImageUrl: detailsData.profileImageUrl || '',
    })
    setIsEditOpen(true)
  }

  function updateEditField(event) {
    const { name, value } = event.target
    setEditForm((current) => ({ ...current, [name]: value }))
  }

  function validateEditForm() {
    const nextErrors = {}
    if (!editForm.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.'
    }
    if (!editForm.position.trim()) {
      nextErrors.position = 'Position is required.'
    }
    if (!editForm.jurisdiction.trim()) {
      nextErrors.jurisdiction = 'Jurisdiction is required.'
    }
    setEditErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSaveEdit(event) {
    event.preventDefault()
    if (!detailsData || !validateEditForm()) {
      return
    }

    const updates = {
      biography: editForm.biography.trim(),
      fullName: editForm.fullName.trim(),
      jurisdiction: editForm.jurisdiction.trim(),
      partyAffiliation: editForm.partyAffiliation.trim(),
      position: editForm.position.trim(),
      profileImageUrl: editForm.profileImageUrl.trim(),
    }

    setDetailsData((current) => ({ ...current, ...updates }))
    onPoliticianUpdate(detailsData.politicianId, updates)
    setIsEditOpen(false)
  }

  return (
    <section className="workspace dashboardWorkspace">
      <section className="dashboardHeaderBlock">
        <h2>Politician Dashboard</h2>
        <p>Browse and select a politician to load their performance dashboard instantly.</p>
      </section>

      <section className="dashboardFilterBar" aria-label="Dashboard filters">
        <label>
          Search politician
          <input
            name="dashboardSearch"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or role"
            type="text"
            value={query}
          />
        </label>
        <label>
          Jurisdiction
          <select
            name="dashboardJurisdiction"
            onChange={(event) => setJurisdictionFilter(event.target.value)}
            value={jurisdictionFilter}
          >
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="CEBU_CITY">Cebu City</option>
          </select>
        </label>
        <form className="dashboardQuickLoad" onSubmit={onSubmit}>
          <Field
            label="Manual ID"
            name="dashboardId"
            onChange={(event) => onChange(event.target.value)}
            value={dashboardId}
          />
          <button disabled={state.status === 'loading'} type="submit">
            Load
          </button>
        </form>
      </section>

      <div className="dashboardDivider" aria-hidden="true" />

      <StatusLine state={politiciansState} />
      <StatusLine state={state} />

      <section className="dashboardCardGrid" aria-label="Politician dashboard selection">
        {filteredPoliticians.length === 0 && <p className="emptyState">No politicians found.</p>}
        {filteredPoliticians.map((politician) => (
          <button
            className="dashboardCard"
            key={politician.politicianId}
            onClick={() => handleCardSelect(politician)}
            type="button"
          >
            <span className="dashboardCardAvatar">
              {politician.profileImageUrl ? (
                <img alt={politician.fullName} src={politician.profileImageUrl} />
              ) : (
                initialsFor(politician.fullName)
              )}
            </span>
            <span className="dashboardCardBody" style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}>
              <strong>{politician.fullName}</strong>
              <small>{politician.position || 'UNKNOWN'}</small>
              <small>{politician.jurisdiction || 'Unspecified jurisdiction'}</small>
              <small>{politician.partyAffiliation || 'Party not disclosed'}</small>
              {politician.coaAuditDiscrepancies > 0 && (
                <span 
                  className="coa-alert-badge"
                  style={{ 
                    alignSelf: 'flex-start', 
                    background: '#fef3c7', 
                    color: '#d97706', 
                    border: '1px solid #f59e0b', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: 'bold', 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px'
                  }}
                >
                  ⚠️ COA Findings Flagged ({politician.coaAuditDiscrepancies})
                </span>
              )}
            </span>
          </button>
        ))}
      </section>

      {isDetailsOpen && detailsData && (
        <div aria-hidden="true" className="detailsModalBackdrop" onClick={() => setIsDetailsOpen(false)}>
          <section
            aria-label="Politician details"
            aria-modal="true"
            className="detailsModal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="detailsModalHeader">
              <h3>Politician Details</h3>
              <button onClick={() => setIsDetailsOpen(false)} type="button">
                Close
              </button>
            </header>
            <div className="detailsModalBody">
              <div className="detailsHero">
                <span className="detailsAvatar">
                  {detailsData.profileImageUrl ? (
                    <img alt={detailsData.fullName} src={detailsData.profileImageUrl} />
                  ) : (
                    initialsFor(detailsData.fullName || '')
                  )}
                </span>
                <div className="detailsIdentity">
                  <h4>{detailsData.fullName}</h4>
                  <p>{detailsData.position || 'UNKNOWN'}</p>
                  <p>{detailsData.jurisdiction || 'Unspecified jurisdiction'}</p>
                  <p>{detailsData.partyAffiliation || 'Party not disclosed'}</p>
                </div>
              </div>
              <section className="detailsBlock">
                <h5>Biography</h5>
                <p>{detailsData.biography || 'No biography information available.'}</p>
              </section>
            </div>
            <footer className="detailsModalFooter">
              <button className="detailsEditButton" onClick={openEditModal} type="button">
                Edit
              </button>
            </footer>
          </section>
        </div>
      )}

      {isEditOpen && (
        <div aria-hidden="true" className="detailsModalBackdrop" onClick={() => setIsEditOpen(false)}>
          <section
            aria-label="Edit politician details"
            aria-modal="true"
            className="editModal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="detailsModalHeader">
              <h3>Edit Politician Details</h3>
              <button onClick={() => setIsEditOpen(false)} type="button">
                Close
              </button>
            </header>
            <form className="editFormGrid" onSubmit={handleSaveEdit}>
              <label>
                Full Name
                <input name="fullName" onChange={updateEditField} required type="text" value={editForm.fullName} />
                {editErrors.fullName && <span className="fieldError">{editErrors.fullName}</span>}
              </label>
              <label>
                Position
                <input name="position" onChange={updateEditField} required type="text" value={editForm.position} />
                {editErrors.position && <span className="fieldError">{editErrors.position}</span>}
              </label>
              <label>
                Jurisdiction
                <select
                  name="jurisdiction"
                  onChange={updateEditField}
                  required
                  value={editForm.jurisdiction}
                >
                  <option value="NATIONAL">NATIONAL</option>
                  <option value="CEBU_CITY">CEBU_CITY</option>
                </select>
                {editErrors.jurisdiction && <span className="fieldError">{editErrors.jurisdiction}</span>}
              </label>
              <label>
                Party / Affiliation
                <input name="partyAffiliation" onChange={updateEditField} type="text" value={editForm.partyAffiliation} />
              </label>
              <label>
                Profile Image URL
                <input name="profileImageUrl" onChange={updateEditField} type="url" value={editForm.profileImageUrl} />
              </label>
              <label>
                Biography
                <textarea name="biography" onChange={updateEditField} rows="5" value={editForm.biography} />
              </label>
              <div className="editModalActions">
                <button onClick={() => setIsEditOpen(false)} type="button">
                  Cancel
                </button>
                <button type="submit">Save Update</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

function ComparisonPanel({ compareIds, onChange, onSubmit, politicians, politiciansState, state }) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filteredPoliticians = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return politicians.filter((politician) => {
      const matchesJurisdiction =
        jurisdictionFilter === 'ALL' || politician.jurisdiction === jurisdictionFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        politician.fullName.toLowerCase().includes(normalizedQuery) ||
        (politician.position || '').toLowerCase().includes(normalizedQuery)
      return matchesJurisdiction && matchesQuery
    })
  }, [jurisdictionFilter, politicians, query])

  const leftCandidates = filteredPoliticians
  const rightCandidates = filteredPoliticians
  const compareDisabled = state.status === 'loading' || !compareIds.idA || !compareIds.idB

  useEffect(() => {
    if (!isModalOpen) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsModalOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isModalOpen])

  function selectCandidate(side, politicianId) {
    if (side === 'left') {
      onChange((current) => ({ ...current, idA: politicianId }))
      return
    }
    onChange((current) => ({ ...current, idB: politicianId }))
  }

  async function handleCompareSubmit(event) {
    const result = await onSubmit(event)
    if (result?.ok) {
      setIsModalOpen(true)
    }
  }

  return (
    <section className="workspace compareWorkspace">
      <section className="compareHeader">
        <h2>Compare Politicians</h2>
        <p>Select one candidate on each side, then run comparison.</p>
      </section>

      <section className="compareFilterBar" aria-label="Candidate filters">
        <label>
          Search candidate
          <input
            name="candidateSearch"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or position"
            type="text"
            value={query}
          />
        </label>
        <label>
          Jurisdiction
          <select
            name="jurisdiction"
            onChange={(event) => setJurisdictionFilter(event.target.value)}
            value={jurisdictionFilter}
          >
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="CEBU_CITY">Cebu City</option>
          </select>
        </label>
      </section>

      <StatusLine state={state} />
      <StatusLine state={politiciansState} />

      <div className="compareSelectionGrid">
        <section className="compareColumn" aria-label="Candidate A selection">
          <p className="compareColumnTitle">Candidate A</p>
          <div className="compareCardList">
            {leftCandidates.length === 0 && <p className="emptyState">No candidates found.</p>}
            {leftCandidates.map((politician) => (
              <button
                className={
                  compareIds.idA === politician.politicianId ? 'compareCard selected' : 'compareCard'
                }
                key={`left-${politician.politicianId}`}
                onClick={() => selectCandidate('left', politician.politicianId)}
                type="button"
              >
                <span className="compareCardAvatar">
                  {politician.profileImageUrl ? (
                    <img alt={politician.fullName} src={politician.profileImageUrl} />
                  ) : (
                    initialsFor(politician.fullName)
                  )}
                </span>
                <span className="compareCardBody">
                  <strong>{politician.fullName}</strong>
                  <small>{politician.position || 'UNKNOWN'}</small>
                  <small>{politician.jurisdiction || 'Unspecified jurisdiction'}</small>
                </span>
                <span className="selectDot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <section className="compareColumn right" aria-label="Candidate B selection">
          <p className="compareColumnTitle">Candidate B</p>
          <div className="compareCardList">
            {rightCandidates.length === 0 && <p className="emptyState">No candidates found.</p>}
            {rightCandidates.map((politician) => (
              <button
                className={
                  compareIds.idB === politician.politicianId ? 'compareCard selected' : 'compareCard'
                }
                key={`right-${politician.politicianId}`}
                onClick={() => selectCandidate('right', politician.politicianId)}
                type="button"
              >
                <span className="compareCardAvatar">
                  {politician.profileImageUrl ? (
                    <img alt={politician.fullName} src={politician.profileImageUrl} />
                  ) : (
                    initialsFor(politician.fullName)
                  )}
                </span>
                <span className="compareCardBody">
                  <strong>{politician.fullName}</strong>
                  <small>{politician.position || 'UNKNOWN'}</small>
                  <small>{politician.jurisdiction || 'Unspecified jurisdiction'}</small>
                </span>
                <span className="selectDot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <form className="compareActionBar" onSubmit={handleCompareSubmit}>
        <button disabled={compareDisabled} type="submit">
          Compare
        </button>
      </form>

      {isModalOpen && state.data && (
        <div
          aria-hidden="true"
          className="comparisonModalBackdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <section
            aria-label="Comparison results"
            aria-modal="true"
            className="comparisonModal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="comparisonModalHeader">
              <h2>Comparison Result</h2>
              <button
                aria-label="Close comparison modal"
                className="comparisonModalClose"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                Close
              </button>
            </header>
            <ComparisonGrid comparison={state.data} />
          </section>
        </div>
      )}
    </section>
  )
}

function ComparisonGrid({ comparison }) {
  const rows = comparison.alignedHorizontalMatrix || []
  return (
    <div className="comparisonGrid">
      <CandidateColumn profile={comparison.profileA} />
      <CandidateColumn profile={comparison.profileB} />
      <section className="matrix">
        <h2>Aligned Evidence Ledger</h2>
        {rows.map((row) => (
          <div className="matrixRow" key={row.categoryTag}>
            <h3>{row.categoryTag}</h3>
            <TimelineLedger entries={row.recordsA || []} compact title="Candidate A" />
            <TimelineLedger entries={row.recordsB || []} compact title="Candidate B" />
          </div>
        ))}
      </section>
    </div>
  )
}

function CandidateColumn({ profile }) {
  return (
    <section className="profileSummary">
      <p className="eyebrow">{profile.position}</p>
      <h2>{profile.fullName}</h2>
      <KpiGrid profile={profile} compact />
    </section>
  )
}

function KpiGrid({ profile, compact = false }) {
  const metrics = [
    ['Bills Authored', profile.billsAuthored],
    ['Projects Completed', profile.projectCompletions],
    ['COA Findings', profile.coaAuditDiscrepancies],
    ['Budget Tracked', formatCurrency(profile.trackedBudgetAllocated)],
    ['Efficiency', `${Number(profile.legislativeEfficiencyRatio || 0).toFixed(1)}%`],
  ]

  return (
    <section className={compact ? 'kpiGrid compact' : 'kpiGrid'}>
      {metrics.map(([label, value]) => (
        <article className="kpiCard" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  )
}

function TimelineLedger({ entries, compact = false, title = 'Published Timeline Ledger' }) {
  return (
    <section className={compact ? 'timeline compact' : 'timeline'}>
      <h2>{title}</h2>
      {entries.length === 0 && <p className="emptyState">No published records returned.</p>}
      {entries.map((entry) => (
        <article className="timelineItem" key={entry.timelineId || `${entry.categoryTag}-${entry.createdAt}`}>
          <div>
            <strong>{entry.actionIdentifier}</strong>
            <span>{entry.categoryTag}</span>
          </div>
          <p>{entry.summary}</p>
          <a href={entry.sourceUrl} rel="noreferrer" target="_blank">
            Source
          </a>
        </article>
      ))}
    </section>
  )
}

function Field({ label, name, onChange, required = true, type = 'text', value }) {
  return (
    <label>
      {label}
      <input name={name} required={required} type={type} value={value} onChange={onChange} />
    </label>
  )
}

function Fact({ label, value }) {
  return (
    <article className="factItem">
      <span>{label}</span>
      <strong>{value || 'Unavailable'}</strong>
    </article>
  )
}

function StatusLine({ state }) {
  if (!state.message) {
    return null
  }
  return <p className={`statusLine ${state.status}`}>{state.message}</p>
}

function initialsFor(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) {
    return null
  }
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

export default App
