import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import ModerationPanel from './components/ModerationPanel'

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
const tabs = ['directory', 'submit', 'dashboard', 'compare', 'moderation']

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || `Request failed with status ${response.status}`)
  }
  return body
}

function App() {
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
    setDashboardState({ status: 'loading', message: 'Loading dashboard...', data: null })
    try {
      const data = await fetch(
        `${API_BASE_URL}/api/politicians/${dashboardId.trim()}/dashboard`,
      ).then(readApiResponse)
      setDashboardState({ status: 'success', message: '', data })
    } catch (error) {
      setDashboardState({ status: 'error', message: error.message, data: null })
    }
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
    } catch (error) {
      setComparisonState({ status: 'error', message: error.message, data: null })
    }
  }

  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">{activeView === 'moderation' ? 'Module 2' : 'Module 1'}</p>
          <h1>{activeView === 'moderation' ? 'Judicial Moderation Engine' : 'Source-First Profile Aggregator'}</h1>
        </div>
        <nav className="viewTabs" aria-label="Module views">
          {tabs.map((view) => (
            <button
              className={activeView === view ? 'active' : ''}
              key={view}
              onClick={() => setActiveView(view)}
              type="button"
            >
              {view}
            </button>
          ))}
        </nav>
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
          onSubmit={handleDashboardLookup}
          state={dashboardState}
        />
      )}

      {activeView === 'compare' && (
        <ComparisonPanel
          compareIds={compareIds}
          onChange={setCompareIds}
          onSubmit={handleComparisonLookup}
          state={comparisonState}
        />
      )}

      {activeView === 'moderation' && (
        <ModerationPanel />
      )}
    </main>
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
          {politicians.length === 0 && <p className="emptyState">No politicians found.</p>}
          {politicians.map((politician) => (
            <button
              className={
                selectedPolitician?.politicianId === politician.politicianId
                  ? 'politicianRow active'
                  : 'politicianRow'
              }
              key={politician.politicianId}
              onClick={() => onSelect(politician.politicianId)}
              type="button"
            >
              <span>{politician.fullName}</span>
              <small>{politician.position || 'UNKNOWN'}</small>
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
    <section className="importedProfile">
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

      <div className="profileFacts">
        <Fact label="Status" value={politician.status} />
        <Fact label="Term start" value={formatDate(politician.termStart)} />
        <Fact label="Term end" value={formatDate(politician.termEnd)} />
      </div>

      <section className="biographyBlock">
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

function DashboardPanel({ dashboardId, onChange, onSubmit, state }) {
  return (
    <section className="workspace">
      <form className="lookupBar" onSubmit={onSubmit}>
        <Field
          label="Politician ID"
          name="dashboardId"
          onChange={(event) => onChange(event.target.value)}
          value={dashboardId}
        />
        <button disabled={state.status === 'loading'} type="submit">
          Load
        </button>
      </form>
      <StatusLine state={state} />
      {state.data && (
        <ProfileDashboard dashboard={state.data} timeline={state.data.publishedTimelineLedger || []} />
      )}
    </section>
  )
}

function ComparisonPanel({ compareIds, onChange, onSubmit, state }) {
  return (
    <section className="workspace">
      <form className="lookupBar twoColumn" onSubmit={onSubmit}>
        <Field
          label="Candidate A ID"
          name="idA"
          value={compareIds.idA}
          onChange={(event) => onChange((current) => ({ ...current, idA: event.target.value }))}
        />
        <Field
          label="Candidate B ID"
          name="idB"
          value={compareIds.idB}
          onChange={(event) => onChange((current) => ({ ...current, idB: event.target.value }))}
        />
        <button disabled={state.status === 'loading'} type="submit">
          Compare
        </button>
      </form>
      <StatusLine state={state} />
      {state.data && <ComparisonGrid comparison={state.data} />}
    </section>
  )
}

function ProfileDashboard({ dashboard, timeline }) {
  return (
    <div className="dashboardGrid">
      <section className="profileSummary">
        <p className="eyebrow">{dashboard.position}</p>
        <h2>{dashboard.fullName}</h2>
        <p>{dashboard.jurisdiction}</p>
        <p>{dashboard.partyAffiliation || 'Independent or undisclosed affiliation'}</p>
      </section>
      <KpiGrid profile={dashboard} />
      <TimelineLedger entries={timeline} />
    </div>
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

function formatDateTime(value) {
  if (!value) {
    return null
  }
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default App
