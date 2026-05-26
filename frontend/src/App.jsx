import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import './App.css'
import ModerationPanel from './components/ModerationPanel'
import { DeveloperSandboxProvider } from './developer/DeveloperSandboxProvider'
import { useDeveloperSandbox } from './developer/DeveloperSandboxContext'
import DeveloperOptionsPanel from './developer/DeveloperOptionsPanel'
import { useAuth } from './auth/AuthContext'
import AuthPages from './auth/AuthPages'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const SOURCE_URL_PATTERN = /^https?:\/\/([a-zA-Z0-9-]+\.)*(gov\.ph|edu\.ph)(\/.*)?$/

const emptySubmission = {
  politicianId: '',
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

function AppInner({ currentUser, onLogout, token }) {
  const sandboxContext = useDeveloperSandbox()
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null
  const currentRole = isDevModeActive && manipulatedUser ? manipulatedUser.role : 'JUDICIAL_REVIEWER'

  const [activeView, setActiveView] = useState('dashboard')
  const [politiciansState, setPoliticiansState] = useState({
    data: [],
    message: '',
    selected: null,
    status: 'idle',
  })
  const [formData, setFormData] = useState(emptySubmission)
  const [submissionState, setSubmissionState] = useState({ status: 'idle', message: '' })
  const [dashboardId, setDashboardId] = useState('')
  const [dashboardState, setDashboardState] = useState({ status: 'idle', message: '', data: null })
  const [selectedPoliticianId, setSelectedPoliticianId] = useState('')
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

  function updateFormField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmission(event) {
    event.preventDefault()
    if (!formData.politicianId) {
      setSubmissionState({
        status: 'error',
        message: 'Please select a politician from the dropdown list.',
      })
      return
    }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  async function openPoliticianProfile(politicianId) {
    if (!politicianId) {
      return
    }
    setSelectedPoliticianId(politicianId)
    setDashboardId(politicianId)
    await loadDashboardById(politicianId)
    setActiveView('profile')
  }

  function openSubmitContributionForPolitician(politicianId) {
    if (!politicianId) {
      return
    }
    setSelectedPoliticianId(politicianId)
    setFormData((current) => ({ ...current, politicianId }))
    setActiveView('submit')
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
      <Sidebar activeView={activeView} onLogout={onLogout} onSelectView={setActiveView} title="PolitikApp" user={currentUser} />

      <section className="pageContent">
        <header className="topBar">
          <div>
            <p className="eyebrow">{activeView === 'moderation' ? 'Module 2' : 'Module 1'}</p>
            <h1>{activeView === 'moderation' ? 'Judicial Moderation Engine' : 'Source-First Profile Aggregator'}</h1>
          </div>
        </header>

        {activeView === 'directory' && (
          <PoliticianDirectoryLoaderPanel
            dashboardId={dashboardId}
            onChange={setDashboardId}
            onViewProfile={openPoliticianProfile}
            onSubmit={handleDashboardLookup}
            politicians={politiciansState.data}
            politiciansState={politiciansState}
            state={dashboardState}
            onPoliticianUpdate={handlePoliticianLocalUpdate}
          />
        )}

        {activeView === 'submit' && (
          <SubmissionPanel
            formData={formData}
            isSourceAllowed={isSourceAllowed}
            onChange={updateFormField}
            onSubmit={handleSubmission}
            selectedPoliticianId={selectedPoliticianId}
            state={submissionState}
            politicians={politiciansState.data}
          />
        )}

        {activeView === 'profile' && (
          <PoliticianProfilePage
            onAddContribution={openSubmitContributionForPolitician}
            onPoliticianUpdate={handlePoliticianLocalUpdate}
            onReload={openPoliticianProfile}
            politicianId={selectedPoliticianId}
            politicians={politiciansState.data}
            state={dashboardState}
          />
        )}

        {activeView === 'dashboard' && (
          <DashboardPanel
            onNavigate={setActiveView}
            politicians={politiciansState.data}
            user={currentUser}
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

        {activeView === 'contributions' && (
          <MyContributionsPanel token={token} />
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
            <ModerationPanel token={token} user={currentUser} />
          )
        )}
        {activeView === 'account' && <UserAccountPage token={token} user={currentUser} />}
      </section>
    </main>
  )
}

function App() {
  const { isAuthenticated, logout, token, user } = useAuth()
  if (!isAuthenticated) {
    return <AuthPages />
  }
  return (
    <DeveloperSandboxProvider>
      <AppInner currentUser={user} onLogout={logout} token={token} />
      <DeveloperOptionsPanel />
    </DeveloperSandboxProvider>
  )
}

function DashboardPanel({ politicians, onNavigate, user }) {
  const totalProfiles = politicians.length
  
  // Dynamically calculate published metrics from loaded politicians
  const totalCoaDiscrepancies = politicians.reduce((acc, curr) => acc + (curr.coaAuditDiscrepancies || 0), 0)
  const averageEfficiency = totalProfiles > 0 
    ? (politicians.reduce((acc, curr) => acc + (curr.efficiencyRatio || 0), 0) / totalProfiles)
    : 0.0

  return (
    <section className="workspace dashboardWorkspace" style={{ gap: '24px' }}>
      <section className="dashboardHeaderBlock" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', color: '#ffffff', border: 'none', position: 'relative', overflow: 'hidden', padding: '32px', borderRadius: '18px', boxShadow: '0 8px 30px rgba(13, 148, 136, 0.15)' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '10%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <h2 style={{ color: '#ffffff', fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Mabuhay, {user?.fullName || 'Guest Contributor'}!</h2>
        <p style={{ color: '#e6f7f4', fontSize: '15px', maxWidth: '640px', margin: 0, opacity: 0.95 }}>
          Welcome to the PolitikApp civic aggregation interface. Track, analyze, and verify official legislative and audit logs across local and national jurisdictions.
        </p>
      </section>

      <div className="profileFacts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '18px' }}>
        <article className="kpiCard" style={{ borderLeft: '4px solid #0f766e', background: '#ffffff', borderRadius: '14px', padding: '18px', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: '700' }}>Politician Profiles</span>
          <strong style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '6px 0 2px' }}>{totalProfiles}</strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Active database profiles</small>
        </article>

        <article className="kpiCard" style={{ borderLeft: '4px solid #f59e0b', background: '#ffffff', borderRadius: '14px', padding: '18px', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: '700' }}>COA Flags Resolved</span>
          <strong style={{ fontSize: '28px', color: '#d97706', margin: '6px 0 2px' }}>{totalCoaDiscrepancies}</strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Audit discrepancies tracked</small>
        </article>

        <article className="kpiCard" style={{ borderLeft: '4px solid #0ea5e9', background: '#ffffff', borderRadius: '14px', padding: '18px', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: '700' }}>Avg Legislative Eff.</span>
          <strong style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '6px 0 2px' }}>{averageEfficiency.toFixed(1)}%</strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sustained profile average</small>
        </article>

        <article className="kpiCard" style={{ borderLeft: '4px solid #a855f7', background: '#ffffff', borderRadius: '14px', padding: '18px', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: '700' }}>My Account Role</span>
          <strong style={{ fontSize: '20px', color: '#7c3aed', margin: '10px 0 2px' }}>{user?.role || 'CONTRIBUTOR'}</strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Authorized session clearance</small>
        </article>
      </div>

      <section style={{ display: 'grid', gap: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Platform Quick Actions</h2>
        
        <div className="dashboardCardGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '18px' }}>
          <button 
            onClick={() => onNavigate('directory')} 
            className="dashboardCard" 
            type="button"
            style={{ minHeight: '130px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ padding: '8px', background: '#e6f7f4', borderRadius: '10px', display: 'inline-flex', fontSize: '18px' }}>📊</span>
            <strong style={{ fontSize: '14px', fontWeight: '800' }}>Explore Directory</strong>
            <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Browse public profiles</small>
          </button>

          <button 
            onClick={() => onNavigate('submit')} 
            className="dashboardCard" 
            type="button"
            style={{ minHeight: '130px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ padding: '8px', background: '#fffbeb', borderRadius: '10px', display: 'inline-flex', fontSize: '18px' }}>✍️</span>
            <strong style={{ fontSize: '14px', fontWeight: '800' }}>File Evidence</strong>
            <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Submit official audit details</small>
          </button>

          <button 
            onClick={() => onNavigate('compare')} 
            className="dashboardCard" 
            type="button"
            style={{ minHeight: '130px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ padding: '8px', background: '#eff6ff', borderRadius: '10px', display: 'inline-flex', fontSize: '18px' }}>⚖️</span>
            <strong style={{ fontSize: '14px', fontWeight: '800' }}>Compare Profiles</strong>
            <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Side-by-side candidates sweep</small>
          </button>

          <button 
            onClick={() => onNavigate('moderation')} 
            className="dashboardCard" 
            type="button"
            style={{ minHeight: '130px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ padding: '8px', background: '#faf5ff', borderRadius: '10px', display: 'inline-flex', fontSize: '18px' }}>🛡️</span>
            <strong style={{ fontSize: '14px', fontWeight: '800' }}>Moderation Jury</strong>
            <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cast double-blind ballot</small>
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '18px', alignItems: 'start' }}>
        <article style={{ background: '#ffffff', border: '1px solid #dbe5ea', borderRadius: '14px', padding: '22px', display: 'grid', gap: '14px', boxShadow: 'var(--shadow-xs)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>System Accountability Guidelines</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', margin: 0 }}>
            To maintain platform integrity, all crowdsourced edit submissions require whitelisted Philippine domains (<strong>.gov.ph</strong> or <strong>.edu.ph</strong>). Post-consensus loops evaluate voter accuracy: peers aligned with the final consensus receive a <strong>+5.0 reputation bump</strong>, while those opposing it receive a <strong>-5.0 penalty</strong>.
          </p>
          <div style={{ padding: '12px 14px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '6px', fontSize: '12px', color: '#b45309', fontWeight: '700', lineHeight: '1.5' }}>
            ⚠️ PENALTY INTERCEPTOR ACTIVE: If a contributor's lifetime rejection metric scales past 15%, their dynamic write clearance tokens are instantly invalidated.
          </div>
        </article>

        <article style={{ background: '#ffffff', border: '1px solid #dbe5ea', borderRadius: '14px', padding: '22px', display: 'grid', gap: '14px', boxShadow: 'var(--shadow-xs)', height: '100%' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Developer Sandbox Status</h3>
          <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #dbe5ea', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Host Environment</span>
              <strong style={{ color: 'var(--text-primary)' }}>Development WiFi</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #dbe5ea', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Active API Host</span>
              <strong style={{ color: 'var(--accent)' }}>{API_BASE_URL}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Auth Session status</span>
              <strong style={{ color: 'var(--success)' }}>ACTIVE</strong>
            </div>
          </div>
        </article>
      </section>
    </section>
  )
}

function UserAccountPage({ token, user }) {
  const [profile, setProfile] = useState(user)
  const [state, setState] = useState({ status: 'idle', message: '' })
  const [form, setForm] = useState({ fullName: user.fullName || '', username: user.username || '' })

  useEffect(() => {
    fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(readApiResponse)
      .then((data) => {
        setProfile(data)
        setForm({ fullName: data.fullName || '', username: data.username || '' })
      })
      .catch(() => null)
  }, [token])

  async function onSave(event) {
    event.preventDefault()
    setState({ status: 'loading', message: 'Saving profile...' })
    try {
      const data = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      }).then(readApiResponse)
      setProfile(data)
      setState({ status: 'success', message: 'Profile updated.' })
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }

  return (
    <section className="workspace">
      <section className="profileSummary">
        <p className="eyebrow">Account</p>
        <h2>{profile?.fullName}</h2>
        <p>{profile?.email}</p>
        <p>Role: {profile?.role}</p>
      </section>
      <form className="editorPanel" onSubmit={onSave}>
        <label>Full Name<input value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} /></label>
        <label>Username<input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} /></label>
        <button type="submit" disabled={state.status === 'loading'}>Save</button>
      </form>
      <StatusLine state={state} />
    </section>
  )
}



function SubmissionPanel({
  formData,
  isSourceAllowed,
  onChange,
  onSubmit,
  selectedPoliticianId,
  state,
  politicians = [],
}) {
  const selectedPolitician = politicians.find((p) => p.politicianId === (formData.politicianId || selectedPoliticianId))
  return (
    <section className="workspace">
      <form className="editorPanel" onSubmit={onSubmit}>
        {selectedPolitician && (
          <p className="statusLine success">
            Adding contribution for: <strong>{selectedPolitician.fullName}</strong>
          </p>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          Select Politician Profile
          <select 
            name="politicianId" 
            value={formData.politicianId} 
            onChange={onChange} 
            required 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          >
            <option value="">-- Choose a Politician Profile --</option>
            {politicians.map((p) => (
              <option key={p.politicianId} value={p.politicianId}>
                {p.fullName} ({p.position || 'UNSPECIFIED'})
              </option>
            ))}
          </select>
        </label>
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

function PoliticianDirectoryLoaderPanel({
  dashboardId,
  onChange,
  onViewProfile,
  onSubmit,
  politicians,
  politiciansState,
  state,
  onPoliticianUpdate,
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
    await onViewProfile(politicianId)
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

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!detailsData || !validateEditForm()) {
      return
    }

    const updates = {
      politicianId: detailsData.politicianId,
      fullName: editForm.fullName.trim(),
      position: editForm.position.trim(),
      jurisdiction: editForm.jurisdiction.trim(),
      partyAffiliation: editForm.partyAffiliation.trim(),
      profileImageUrl: editForm.profileImageUrl.trim(),
      biography: editForm.biography.trim(),
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/politicians/${detailsData.politicianId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const savedData = await readApiResponse(res)
        setDetailsData((current) => ({ ...current, ...savedData }))
        onPoliticianUpdate(detailsData.politicianId, savedData)
        setIsEditOpen(false)
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.message || 'Failed to persist profile updates to database.')
      }
    } catch (err) {
      console.error(err)
      alert('Network error: Could not contact server to save profile updates.')
    }
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
      {state.status === 'loading' && <PageSectionLoader />}

      <section className="dashboardCardGrid" aria-label="Politician dashboard selection">
        {state.status === 'loading' && <LoadingSkeletonCards count={4} />}
        {state.status !== 'loading' && filteredPoliticians.length === 0 && <p className="emptyState">No politicians found.</p>}
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

function PoliticianProfilePage({
  onAddContribution,
  onPoliticianUpdate,
  onReload,
  politicianId,
  politicians,
  state,
}) {
  const fallbackProfile = politicians.find((p) => p.politicianId === politicianId) || null
  const profile = state.data || fallbackProfile
  const timelineEntries =
    state.data?.publishedTimelineLedger ||
    state.data?.timeline ||
    state.data?.entries ||
    []
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({
    biography: '',
    fullName: '',
    jurisdiction: '',
    partyAffiliation: '',
    position: '',
    profileImageUrl: '',
  })

  function openEditModal() {
    if (!profile) {
      return
    }
    setEditErrors({})
    setEditForm({
      biography: profile.biography || '',
      fullName: profile.fullName || '',
      jurisdiction: profile.jurisdiction || '',
      partyAffiliation: profile.partyAffiliation || '',
      position: profile.position || '',
      profileImageUrl: profile.profileImageUrl || '',
    })
    setIsEditOpen(true)
  }

  function updateEditField(event) {
    const { name, value } = event.target
    setEditForm((current) => ({ ...current, [name]: value }))
  }

  function validateEditForm() {
    const nextErrors = {}
    if (!editForm.fullName.trim()) nextErrors.fullName = 'Full name is required.'
    if (!editForm.position.trim()) nextErrors.position = 'Position is required.'
    if (!editForm.jurisdiction.trim()) nextErrors.jurisdiction = 'Jurisdiction is required.'
    setEditErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!profile || !validateEditForm()) {
      return
    }

    const updates = {
      politicianId: profile.politicianId,
      fullName: editForm.fullName.trim(),
      position: editForm.position.trim(),
      jurisdiction: editForm.jurisdiction.trim(),
      partyAffiliation: editForm.partyAffiliation.trim(),
      profileImageUrl: editForm.profileImageUrl.trim(),
      biography: editForm.biography.trim(),
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/politicians/${profile.politicianId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.message || 'Failed to persist profile updates to database.')
        return
      }
      const savedData = await readApiResponse(res)
      onPoliticianUpdate(profile.politicianId, savedData)
      setIsEditOpen(false)
      await onReload(profile.politicianId)
    } catch (err) {
      console.error(err)
      alert('Network error: Could not contact server to save profile updates.')
    }
  }

  if (!politicianId) {
    return (
      <section className="workspace">
        <p className="emptyState">Select a politician card first.</p>
      </section>
    )
  }

  return (
    <section className="workspace">
      <StatusLine state={state} />
      {state.status === 'loading' && <PageSectionLoader />}
      {state.status === 'loading' && !profile && <ProfileSkeleton />}
      {profile && (
        <>
          <section className="profileSummary">
            <p className="eyebrow">{profile.position || 'UNKNOWN'}</p>
            <h2>{profile.fullName}</h2>
            <p>{profile.jurisdiction || 'Unspecified jurisdiction'}</p>
            <p>{profile.partyAffiliation || 'Party affiliation unavailable'}</p>
          </section>
          <div style={{ display: 'flex', gap: '10px', margin: '12px 0 16px' }}>
            <button onClick={openEditModal} type="button">Edit Profile</button>
            <button onClick={() => onAddContribution(profile.politicianId)} type="button">Add Contribution</button>
          </div>
          <KpiGrid profile={profile} />
          <section className="biographyBlock" style={{ marginTop: '20px' }}>
            <h2>Biography</h2>
            <p>{profile.biography || 'No biography information available.'}</p>
          </section>
          <TimelineLedger entries={timelineEntries} title="Published Contribution / History Timeline" />
        </>
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
  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3 text-slate-700 shadow-sm transition-opacity duration-300 ease-out">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-hidden="true" />
          <span className="sr-only">{state.message}</span>
          <div className="h-2.5 w-48 rounded-full bg-slate-200/80 animate-pulse" aria-hidden="true" />
        </div>
      </div>
    )
  }
  return (
    <p className={`statusLine ${state.status}`}>
      {state.message}
    </p>
  )
}

function LoadingSkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="h-16 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:220%_100%] animate-[pulse_1.5s_ease-in-out_infinite]"
          key={`s-row-${index}`}
        />
      ))}
    </div>
  )
}

function LoadingSkeletonCards({ count = 4 }) {
  return (
    <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article
          className="grid min-h-[152px] grid-cols-[94px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5"
          key={`s-card-${index}`}
        >
          <span className="h-[94px] w-[94px] rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
          <div className="space-y-2.5">
            <span className="block h-4 w-2/3 rounded-md bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
            <span className="block h-3 w-1/2 rounded-md bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
            <span className="block h-3 w-3/5 rounded-md bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
          </div>
        </article>
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 ease-out">
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" aria-hidden="true" />
          <span className="text-sm font-medium">Loading profile</span>
        </div>
      </div>

      <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-5 max-md:grid-cols-1">
        <div className="h-[132px] w-[132px] rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
          <div className="h-8 w-2/3 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-4" key={`kpi-${index}`}>
            <div className="h-3 w-2/3 rounded bg-slate-200 animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="space-y-2 border-t border-slate-100 pt-3" key={`tl-${index}`}>
            <div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  )
}

function PageSectionLoader() {
  return (
    <section className="flex min-h-[140px] items-center justify-center rounded-xl border border-slate-200 bg-white/90 p-6 shadow-sm transition-all duration-300 ease-out" aria-live="polite">
      <div className="flex items-center gap-3 text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-wide">Loading content</span>
      </div>
    </section>
  )
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

function MyContributionsPanel({ token }) {
  const [contributions, setContributions] = useState([])
  const [state, setState] = useState({
    status: 'loading',
    message: 'Retrieving your crowdsourced contribution history...'
  })

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/submissions/my`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(readApiResponse)
      .then((data) => {
        setContributions(Array.isArray(data) ? data : [])
        setState({ status: 'success', message: '' })
      })
      .catch((err) => {
        setContributions([])
        setState({ status: 'error', message: err.message })
      })
  }, [token])

  const STAGES = ['SUBMITTED', 'JURY_REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED']

  function stageIndexFor(status) {
    switch ((status || '').toUpperCase()) {
      case 'SUBMITTED':
      case 'PENDING': return 0;
      case 'JURY_REVIEW': return 1;
      case 'ESCALATED':
      case 'REVISION_REQUIRED': return 2;
      case 'REJECTED': return 3;
      case 'PUBLISHED': return 4;
      default: return 0;
    }
  }

  return (
    <section className="workspace">
      <section className="dashboardHeaderBlock" style={{ padding: '20px' }}>
        <h2>My Crowdsourced Contributions</h2>
        <p>Track the dynamic verification status of your submitted political records.</p>
      </section>

      <StatusLine state={state} />

      <div style={{ display: 'grid', gap: '20px', marginTop: '10px' }}>
        {state.status !== 'loading' && contributions.length === 0 && (
          <p className="emptyState" style={{ background: '#ffffff', border: '1px dashed #dbe5ea', borderRadius: '14px', padding: '40px' }}>
            You haven't submitted any political record edits yet. Go to the "Submit Evidence" tab to file your first record!
          </p>
        )}

        {contributions.map((item) => {
          const activeStage = stageIndexFor(item.status)
          return (
            <article key={item.submissionId} className="review-card" style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #dbe5ea', boxShadow: 'var(--shadow-xs)', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1e40af', padding: '4px 9px', borderRadius: '999px', fontWeight: '800' }}>
                  ID: {item.submissionId.substring(0, 8)}
                </span>
                <span style={{ fontSize: '12px', color: '#6e8594', fontWeight: 'bold' }}>
                  Filed: {formatDate(item.createdAt)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div><span style={{ color: '#6e8594' }}>Category:</span> <strong>{item.categoryTag}</strong></div>
                <div><span style={{ color: '#6e8594' }}>Action Tag:</span> <strong>{item.actionIdentifier}</strong></div>
                <div><span style={{ color: '#6e8594' }}>Metric:</span> <strong>{item.quantitativeMetric ? formatCurrency(item.quantitativeMetric) : 'N/A'}</strong></div>
              </div>

              <div style={{ background: '#f7fafc', border: '1px solid #dbe5ea', borderLeft: '4px solid #0f766e', padding: '12px', borderRadius: '0 8px 8px 0', fontStyle: 'italic', fontSize: '13px', color: 'var(--text-secondary)' }}>
                "{item.impactSummary}"
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#6e8594' }}>Source:</span>{' '}
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#0f766e', fontWeight: 'bold', textDecoration: 'none' }}>
                  {item.sourceUrl}
                </a>
              </div>

              <div style={{ marginTop: '8px', paddingTop: '14px', borderTop: '1px dashed #dbe5ea' }}>
                <h5 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 10px 0', color: 'var(--text-primary)' }}>Dynamic Edit Lifecycle Stage</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
                  {STAGES.map((stage, index) => {
                    const isPassed = index <= activeStage
                    let bg = '#f8fafc'
                    let fg = '#64748b'
                    if (isPassed) {
                      bg = item.status === 'REJECTED' && index === 3 ? '#ef4444' : '#0f766e'
                      fg = '#ffffff'
                    }
                    return (
                      <span
                        key={`${item.submissionId}-${stage}`}
                        style={{
                          textAlign: 'center',
                          padding: '6px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid #d1d5db',
                          background: bg,
                          color: fg,
                          transition: 'all 220ms ease',
                        }}
                      >
                        {stage === 'FINALIZED' && item.status === 'REJECTED' ? 'REJECTED' : stage.replace('_', ' ')}
                      </span>
                    )
                  })}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default App
