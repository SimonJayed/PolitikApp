import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import ModerationPanel from './components/ModerationPanel'
import UserProfileMatrixPanel from './components/UserProfileMatrixPanel'
import { DeveloperSandboxProvider } from './developer/DeveloperSandboxProvider'
import { useDeveloperSandbox } from './developer/DeveloperSandboxContext'
import DeveloperOptionsPanel from './developer/DeveloperOptionsPanel'
import { useAuth } from './auth/AuthContext'
import AuthPages from './auth/AuthPages'
import TopNav from './components/TopNav'
import {
  AlertTriangleIcon,
  BarChart3Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  KeyIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from './components/icons/Lucide'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const SOURCE_URL_PATTERN = /^https?:\/\/([a-zA-Z0-9-]+\.)*(gov\.ph|edu\.ph)(\/.*)?$/

const emptySubmission = {
  politicianId: '',
  sourceUrl: '',
  categoryTag: 'Audit',
  actionIdentifier: 'COA_FINDING',
  actionDetails: {},
  impactSummary: '',
}

const actionOptions = [
  'COA_FINDING',
  'BUDGET_ALLOCATION',
  'PROJECT_COMPLETION',
  'SPONSORED_LEGISLATION',
]

const categoryOptions = ['Audit', 'Finance', 'Infrastructure', 'Healthcare', 'Education']

const actionDetailFields = {
  COA_FINDING: [
    { key: 'flaggedAmount', label: 'Audit Flagged Amount (PHP)', type: 'number' },
  ],
  BUDGET_ALLOCATION: [
    { key: 'allocationAmount', label: 'Budget Allocation Amount (PHP)', type: 'number' },
  ],
  PROJECT_COMPLETION: [
    { key: 'completionPercentage', label: 'Project Completion Percentage (%)', max: 100, type: 'number' },
  ],
  SPONSORED_LEGISLATION: [
    { key: 'legislationTitle', label: 'Legislation Title', type: 'text' },
    { key: 'dateFiled', label: 'Date Filed', type: 'date' },
    {
      key: 'legislativeStatus',
      label: 'Legislative Status',
      options: ['Filed', 'In Committee', 'Approved', 'Rejected', 'Withdrawn'],
      type: 'select',
    },
  ],
}

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

  const activeHeader = {
    account: ['Account', 'User Account'],
    compare: ['Compare', 'Compare Politicians'],
    contributions: ['Submissions', 'My Contribution Ledger'],
    dashboard: ['Dashboard', 'Source-First Profile Aggregator'],
    directory: ['Directory', 'Politician Directory'],
    moderation: ['Moderation', 'Judicial Moderation Engine'],
    profile: ['Profiles', 'Published Profile Dashboard'],
    profileMatrix: ['Developer Sandbox', 'Core Profile Metrics Matrix'],
    submit: ['Submissions', 'Evidence Submission Console'],
  }[activeView] || ['Dashboard', 'Source-First Profile Aggregator']

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
    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === 'actionIdentifier' ? { actionDetails: {} } : {}),
    }))
  }

  function updateActionDetail(key, value) {
    setFormData((current) => ({
      ...current,
      actionDetails: {
        ...(current.actionDetails || {}),
        [key]: value,
      },
    }))
  }

  async function handleSubmission(event) {
    event.preventDefault()
    if (!formData.politicianId) {
      setSubmissionState({ status: 'error', message: 'Please select a politician from the dropdown list.' })
      return
    }
    if (!isSourceAllowed) {
      setSubmissionState({ status: 'error', message: 'Source URL must resolve to an approved .gov.ph or .edu.ph domain.' })
      return
    }
    setSubmissionState({ status: 'loading', message: 'Submitting evidence record...' })
    try {
      const payload = {
        ...formData,
        contributorId: currentUser?.userId,
        actionDetails: normalizeActionDetails(formData.actionDetails),
        sourceUrl: formData.sourceUrl.trim(),
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
      const data = await fetch(`${API_BASE_URL}/api/politicians/${politicianId}/dashboard`).then(readApiResponse)
      setDashboardState({ status: 'success', message: '', data })
      return { ok: true, data }
    } catch (error) {
      setDashboardState({ status: 'error', message: error.message, data: null })
      return { ok: false, error }
    }
  }

  async function openPoliticianProfile(politicianId) {
    if (!politicianId) return
    setSelectedPoliticianId(politicianId)
    setDashboardId(politicianId)
    await loadDashboardById(politicianId)
    setActiveView('profile')
  }

  function openSubmitContributionForPolitician(politicianId) {
    if (!politicianId) return
    setSelectedPoliticianId(politicianId)
    setFormData((current) => ({ ...current, politicianId }))
    setActiveView('submit')
  }

  function handlePoliticianLocalUpdate(politicianId, updates) {
    setPoliticiansState((current) => {
      const nextData = current.data.map((p) =>
        p.politicianId === politicianId ? { ...p, ...updates } : p,
      )
      const nextSelected =
        current.selected && current.selected.politicianId === politicianId
          ? { ...current.selected, ...updates }
          : current.selected
      return { ...current, data: nextData, selected: nextSelected }
    })
    setDashboardState((current) => {
      if (!current.data || current.data.politicianId !== politicianId) return current
      return { ...current, data: { ...current.data, ...updates } }
    })
  }

  async function handleComparisonLookup(event) {
    event.preventDefault()
    const params = new URLSearchParams({ idA: compareIds.idA.trim(), idB: compareIds.idB.trim() })
    setComparisonState({ status: 'loading', message: 'Building comparison...', data: null })
    try {
      const data = await fetch(`${API_BASE_URL}/api/politicians/compare?${params}`).then(readApiResponse)
      setComparisonState({ status: 'success', message: '', data })
      return { ok: true, data }
    } catch (error) {
      setComparisonState({ status: 'error', message: error.message, data: null })
      return { ok: false, error }
    }
  }

  return (
    <main className="appShell">
      <TopNav
        activeView={activeView}
        onLogout={onLogout}
        onSelectView={setActiveView}
        title="PolitikApp"
        user={currentUser}
      />

      <section className="pageContent pt-32 sm:pt-36">
        <header className="topBar">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--ph-blue)] ring-1 ring-black/5">
              <span className="ty-nav font-extrabold" aria-hidden="true">
                {activeHeader[0]?.slice(0, 1) || 'P'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="ty-label">{activeHeader[0]}</p>
              <p className="ty-nav truncate text-[color:var(--text-primary)]">{activeHeader[1]}</p>
            </div>
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
            onDetailChange={updateActionDetail}
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
        {activeView === 'contributions' && <MyContributionsPanel user={currentUser} />}
        {activeView === 'profileMatrix' && <UserProfileMatrixPanel token={token} user={currentUser} />}
        {activeView === 'moderation' && (
          currentRole === 'CONTRIBUTOR' ? (
            <section className="workspace">
              <div style={{
                textAlign: 'center',
                padding: '48px 32px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-soft)',
                  marginBottom: '16px',
                }}>
                  <AlertTriangleIcon size={22} />
                </div>
                <h2 className="ty-section-title" style={{ color: 'var(--danger)', margin: '0 0 10px' }}>Access Restricted</h2>
                <p className="ty-body" style={{ color: 'var(--text-muted)', margin: '0 auto', maxWidth: '460px' }}>
                  Contributor accounts do not have authorized clearance to view or moderate pending queue cards.
                </p>
                <p className="ty-meta" style={{ color: 'var(--text-subtle)', marginTop: '16px', fontStyle: 'italic' }}>
                  Presentation Note: Open the floating user profile drawer to reset your Session Role Override to JUDICIAL_REVIEWER.
                </p>
              </div>
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
  if (!isAuthenticated) return <AuthPages />
  return (
    <DeveloperSandboxProvider>
      <AppInner currentUser={user} onLogout={logout} token={token} />
      <DeveloperOptionsPanel />
    </DeveloperSandboxProvider>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Dashboard                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
function DashboardPanel({ politicians, onNavigate, user }) {
  const totalProfiles = politicians.length
  const totalCoaDiscrepancies = politicians.reduce((acc, curr) => acc + (curr.coaAuditDiscrepancies || 0), 0)
  const averageEfficiency = totalProfiles > 0
    ? politicians.reduce((acc, curr) => acc + (curr.efficiencyRatio || 0), 0) / totalProfiles
    : 0

  const kpis = [
    {
      label: 'Politician Profiles',
      value: totalProfiles,
      sub: 'Active database profiles',
      accent: 'var(--ph-blue)',
      icon: FolderIcon,
    },
    {
      label: 'COA Flags Tracked',
      value: totalCoaDiscrepancies,
      sub: 'Audit discrepancies logged',
      accent: 'var(--ph-gold)',
      icon: AlertTriangleIcon,
    },
    {
      label: 'Avg. Legislative Eff.',
      value: `${averageEfficiency.toFixed(1)}%`,
      sub: 'Sustained profile average',
      accent: 'var(--info)',
      icon: BarChart3Icon,
    },
    {
      label: 'My Clearance Role',
      value: user?.role || 'CONTRIBUTOR',
      sub: 'Authorized session role',
      accent: 'var(--ph-red)',
      icon: KeyIcon,
    },
  ]

  const actions = [
    {
      key: 'directory',
      icon: UsersIcon,
      title: 'Explore Directory',
      sub: 'Browse all politician profiles',
      color: '#e8f0fe',
      iconBg: '#c7d7fc',
    },
    {
      key: 'submit',
      icon: FileTextIcon,
      title: 'File Evidence',
      sub: 'Submit an official audit record',
      color: '#fef9e8',
      iconBg: '#faedb4',
    },
    {
      key: 'compare',
      icon: ScaleIcon,
      title: 'Compare Profiles',
      sub: 'Side-by-side candidate analysis',
      color: '#eef6ff',
      iconBg: '#c3ddf9',
    },
    {
      key: 'moderation',
      icon: ShieldCheckIcon,
      title: 'Moderation Jury',
      sub: 'Cast a double-blind ballot',
      color: '#f3f0ff',
      iconBg: '#dbd5fd',
    },
  ]

  return (
    <section className="workspace dashboardWorkspace" style={{ gap: '20px' }}>

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(148deg, var(--ph-blue) 0%, #0c1e4a 55%, #06102a 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'clamp(24px, 4vw, 36px)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(8, 20, 50, 0.28)',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '5%', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20px', right: '18%', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(184, 150, 42, 0.6)' }} />
        <div style={{ position: 'absolute', bottom: '30px', right: '35%', width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(184, 150, 42, 0.35)' }} />

        <div style={{ position: 'relative' }}>
          <span
            className="ty-label"
            style={{ color: 'rgba(153, 132, 44, 0.95)', marginBottom: '10px', display: 'inline-block' }}
          >
            Live: Civic Transparency Platform
          </span>
          <h2 className="ty-section-title" style={{
            color: '#ffffff',
            margin: '0 0 10px',
            letterSpacing: '-0.02em',
            lineHeight: '1.15',
            fontSize: 'clamp(1.25rem, 2.2vw, 1.6rem)',
          }}>
            Mabuhay, {user?.fullName?.split(' ')[0] || 'Contributor'}.
          </h2>
          <p style={{ color: 'rgba(220, 228, 245, 0.82)', fontSize: '14px', lineHeight: '1.7', margin: 0, maxWidth: '560px' }}>
            Track, analyze, and verify official legislative and audit records across local and national Philippine jurisdictions.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
        {kpis.map(({ label, value, sub, accent, icon: Icon }) => (
          <article key={label} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line-soft)',
            borderLeft: `3px solid ${accent}`,
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <span aria-hidden="true" className="inline-flex items-center justify-center" style={{ width: '22px', height: '22px', color: accent }}>
              <Icon size={18} />
            </span>
            <span className="ty-label" style={{ marginTop: '4px' }}>{label}</span>
            <strong style={{
              fontFamily: 'var(--display)',
              fontSize: 'clamp(1.3rem, 2vw, 1.8rem)',
              fontWeight: '800',
              color: 'var(--text-primary)',
              lineHeight: '1.1',
              letterSpacing: '-0.03em',
            }}>{value}</strong>
            <small className="ty-meta">{sub}</small>
          </article>
        ))}
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="ty-section-title" style={{ margin: '0 0 14px' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
          {actions.map(({ key, icon: Icon, title, sub, color, iconBg }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              type="button"
              className="dashboardCard"
              style={{
                minHeight: '120px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                gridTemplateColumns: 'none',
                background: 'var(--bg-surface)',
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                background: color,
                border: `1px solid ${iconBg}`,
                color: 'var(--ph-blue)',
              }}>
                <Icon size={18} />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <strong className="ty-card-title">{title}</strong>
                <small className="ty-meta">{sub}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Info row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: '16px', alignItems: 'start' }}>
        <article style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-xs)',
          display: 'grid',
          gap: '16px',
        }}>
          <h3 className="ty-card-title" style={{ margin: 0 }}>Platform Accountability Rules</h3>
          <p className="ty-body" style={{ margin: 0 }}>
            All crowdsourced submissions require whitelisted Philippine domains (<strong>.gov.ph</strong> or <strong>.edu.ph</strong>). 
            After consensus, voters aligned with the final ruling receive a <strong>+5.0 reputation bump</strong>; opposing voters receive a <strong>−5.0 penalty</strong>.
          </p>
          <div style={{
            padding: '13px 16px',
            background: '#fffbeb',
            border: '1px solid var(--warning-border)',
            borderLeft: '3px solid var(--ph-gold)',
            borderRadius: 'var(--radius-sm)',
            color: '#7a5500',
            fontFamily: 'var(--mono, monospace)',
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.02em',
            lineHeight: '1.6',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangleIcon size={16} />
              <span>INTERCEPTOR ACTIVE: Contributors exceeding a 15% lifetime rejection rate will have write tokens automatically revoked.</span>
            </span>
          </div>
        </article>

        <article style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-xs)',
          display: 'grid',
          gap: '14px',
        }}>
          <h3 className="ty-card-title" style={{ margin: 0 }}>Sandbox Status</h3>
          <div style={{ display: 'grid', gap: '0' }}>
            {[
              ['Host', 'Development'],
              ['API Host', API_BASE_URL],
              ['Auth Session', 'ACTIVE'],
            ].map(([key, val], i, arr) => (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--line-hairline)' : 'none',
              }}>
                <span className="ty-meta" style={{ color: 'var(--text-muted)' }}>{key}</span>
                <strong style={{
                  fontFamily: 'var(--mono, monospace)',
                  fontSize: '12px',
                  color: key === 'Auth Session' ? 'var(--success)' : key === 'API Host' ? 'var(--info)' : 'var(--text-primary)',
                  fontWeight: '600',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}>{val}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  User Account Page                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
function UserAccountPage({ token, user }) {
  const [profile, setProfile] = useState(user)
  const [state, setState] = useState({ status: 'idle', message: '' })
  const [form, setForm] = useState({ fullName: user.fullName || '', username: user.username || '' })

  useEffect(() => {
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
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
        <p className="eyebrow ty-page-kicker">Account</p>
        <h2 className="ty-section-title">{profile?.fullName}</h2>
        <p className="ty-body">{profile?.email}</p>
        <p className="ty-body">Role: {profile?.role}</p>
      </section>
      <form className="editorPanel" onSubmit={onSave}>
        <label>Full Name<input value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} /></label>
        <label>Username<input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} /></label>
        <button type="submit" disabled={state.status === 'loading'}>Save Changes</button>
      </form>
      <StatusLine state={state} />
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Submission Panel                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
function SubmissionPanel({ formData, isSourceAllowed, onChange, onDetailChange, onSubmit, selectedPoliticianId, state, politicians = [] }) {
  const selectedPolitician = politicians.find((p) => p.politicianId === (formData.politicianId || selectedPoliticianId))
  return (
    <section className="workspace">
      <form className="editorPanel" onSubmit={onSubmit}>
        {selectedPolitician && (
          <p className="statusLine success">
            Adding contribution for: <strong style={{ marginLeft: '6px' }}>{selectedPolitician.fullName}</strong>
          </p>
        )}
        <label>
          Select Politician Profile
          <select name="politicianId" value={formData.politicianId} onChange={onChange} required>
            <option value="">— Choose a Politician Profile —</option>
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
              {categoryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label>
            Action
            <select name="actionIdentifier" value={formData.actionIdentifier} onChange={onChange}>
              {actionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>
        <ActionDetailsFields
          actionDetails={formData.actionDetails || {}}
          actionIdentifier={formData.actionIdentifier}
          onChange={onDetailChange}
        />
        <label>
          Impact Summary
          <textarea name="impactSummary" required rows="5" value={formData.impactSummary} onChange={onChange} />
        </label>
        <div className="formFooter">
          <span className={isSourceAllowed ? 'sourceBadge approved' : 'sourceBadge'}>
            {isSourceAllowed ? '✓ Approved source' : '○ Awaiting approved source'}
          </span>
          <button disabled={state.status === 'loading'} type="submit">Submit Evidence</button>
        </div>
        <StatusLine state={state} />
      </form>
    </section>
  )
}

function ActionDetailsFields({ actionDetails, actionIdentifier, onChange }) {
  const fields = actionDetailFields[actionIdentifier] || [{ key: 'metric', label: 'Metric', type: 'number' }]
  return (
    <div className="fieldRow">
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          {field.type === 'select' ? (
            <select
              name={field.key}
              required
              value={actionDetails[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
            >
              <option value="">Select status</option>
              {field.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input
              max={field.max}
              min={field.type === 'number' ? '0' : undefined}
              name={field.key}
              required
              step={field.type === 'number' ? 'any' : undefined}
              type={field.type}
              value={actionDetails[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Politician Directory                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
function PoliticianDirectoryLoaderPanel({
  dashboardId, onChange, onViewProfile, onSubmit,
  politicians, politiciansState, state, onPoliticianUpdate,
}) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 9
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [detailsData, setDetailsData] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({
    biography: '', fullName: '', jurisdiction: '',
    partyAffiliation: '', position: '', profileImageUrl: '',
  })

  const filteredPoliticians = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((p) => {
      const matchesJurisdiction = jurisdictionFilter === 'ALL' || p.jurisdiction === jurisdictionFilter
      const matchesQuery = !q || p.fullName.toLowerCase().includes(q) || (p.position || '').toLowerCase().includes(q)
      return matchesJurisdiction && matchesQuery
    })
  }, [jurisdictionFilter, politicians, query])

  useEffect(() => {
    setPage(1)
  }, [query, jurisdictionFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPoliticians.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedPoliticians = filteredPoliticians.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    if (!isDetailsOpen && !isEditOpen) return undefined
    function handleEscape(e) {
      if (e.key === 'Escape') { setIsEditOpen(false); setIsDetailsOpen(false) }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', handleEscape) }
  }, [isDetailsOpen, isEditOpen])

  async function handleCardSelect(politician) {
    await onViewProfile(politician.politicianId)
  }

  function openEditModal() {
    if (!detailsData) return
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

  function updateEditField(e) {
    const { name, value } = e.target
    setEditForm((c) => ({ ...c, [name]: value }))
  }

  function validateEditForm() {
    const errors = {}
    if (!editForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!editForm.position.trim()) errors.position = 'Position is required.'
    if (!editForm.jurisdiction.trim()) errors.jurisdiction = 'Jurisdiction is required.'
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!detailsData || !validateEditForm()) return
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
        setDetailsData((c) => ({ ...c, ...savedData }))
        onPoliticianUpdate(detailsData.politicianId, savedData)
        setIsEditOpen(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to persist profile updates.')
      }
    } catch (err) {
      alert('Network error: Could not save profile updates.')
    }
  }

  return (
    <section className="workspace dashboardWorkspace">
      <section className="dashboardHeaderBlock">
        <h2 className="ty-section-title">Politician Directory</h2>
        <p className="ty-body">Browse and select a politician to load their performance profile instantly.</p>
      </section>

      <section className="dashboardFilterBar" aria-label="Directory filters">
        <label>
          Search
          <input
            name="dashboardSearch"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or position"
            type="text"
            value={query}
          />
        </label>
        <label>
          Jurisdiction
          <select name="dashboardJurisdiction" onChange={(e) => setJurisdictionFilter(e.target.value)} value={jurisdictionFilter}>
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="CEBU_CITY">Cebu City</option>
          </select>
        </label>
        <form className="dashboardQuickLoad" onSubmit={onSubmit}>
          <Field label="Manual ID" name="dashboardId" onChange={(e) => onChange(e.target.value)} value={dashboardId} />
          <button disabled={state.status === 'loading'} type="submit">Load</button>
        </form>
      </section>

      <div className="dashboardDivider" aria-hidden="true" />
      <StatusLine state={politiciansState} />
      <StatusLine state={state} />
      {state.status === 'loading' && <PageSectionLoader />}

      <div className="flex items-center justify-between gap-3">
        <p className="ty-meta text-[color:var(--text-muted)]">
          Showing {filteredPoliticians.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredPoliticians.length)} of {filteredPoliticians.length}
        </p>
        <PaginationMini page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>

      <section className="dashboardCardGrid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Politician directory">
        {state.status === 'loading' && <LoadingSkeletonCards count={4} />}
        {state.status !== 'loading' && filteredPoliticians.length === 0 && (
          <p className="emptyState" style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center' }}>No politicians found matching your search.</p>
        )}
        {pagedPoliticians.map((politician) => (
          <button
            className="dashboardCard"
            key={politician.politicianId}
            onClick={() => handleCardSelect(politician)}
            type="button"
          >
            <span className="dashboardCardAvatar">
              {politician.profileImageUrl ? (
                <img alt={politician.fullName} src={politician.profileImageUrl} />
              ) : initialsFor(politician.fullName)}
            </span>
            <span className="dashboardCardBody">
              <strong className="ty-card-title">{politician.fullName}</strong>
              <small className="ty-meta">{politician.position || 'UNKNOWN'}</small>
              <small className="ty-meta">{politician.jurisdiction || 'Unspecified'}</small>
              <small className="ty-meta">{politician.partyAffiliation || 'Party not disclosed'}</small>
              {politician.coaAuditDiscrepancies > 0 && (
                <span style={{
                  alignSelf: 'flex-start',
                  background: '#fef9e8',
                  color: '#92660a',
                  border: '1px solid #f0c040',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontFamily: 'var(--mono, monospace)',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '6px',
                  letterSpacing: '0.02em',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangleIcon size={14} />
                    <span>COA Findings ({politician.coaAuditDiscrepancies})</span>
                  </span>
                </span>
              )}
            </span>
          </button>
        ))}
      </section>

      {isDetailsOpen && detailsData && (
        <div aria-hidden="true" className="detailsModalBackdrop" onClick={() => setIsDetailsOpen(false)}>
          <section aria-label="Politician details" aria-modal="true" className="detailsModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="detailsModalHeader">
              <h3 className="ty-section-title">Politician Details</h3>
              <button onClick={() => setIsDetailsOpen(false)} type="button">Close</button>
            </header>
            <div className="detailsModalBody">
              <div className="detailsHero">
                <span className="detailsAvatar">
                  {detailsData.profileImageUrl
                    ? <img alt={detailsData.fullName} src={detailsData.profileImageUrl} />
                    : initialsFor(detailsData.fullName || '')}
                </span>
                <div className="detailsIdentity">
                  <h4 className="ty-section-title">{detailsData.fullName}</h4>
                  <p className="ty-body">{detailsData.position || 'UNKNOWN'}</p>
                  <p className="ty-body">{detailsData.jurisdiction || 'Unspecified'}</p>
                  <p className="ty-body">{detailsData.partyAffiliation || 'Party not disclosed'}</p>
                </div>
              </div>
              <section className="detailsBlock">
                <h5 className="ty-label" style={{ margin: 0 }}>Biography</h5>
                <p className="ty-body">{detailsData.biography || 'No biography available.'}</p>
              </section>
            </div>
            <footer className="detailsModalFooter">
              <button onClick={openEditModal} type="button">Edit Profile</button>
            </footer>
          </section>
        </div>
      )}

      {isEditOpen && (
        <div aria-hidden="true" className="detailsModalBackdrop" onClick={() => setIsEditOpen(false)}>
          <section aria-label="Edit politician" aria-modal="true" className="editModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="detailsModalHeader">
              <h3 className="ty-section-title">Edit Politician</h3>
              <button onClick={() => setIsEditOpen(false)} type="button">Close</button>
            </header>
            <form className="editFormGrid" onSubmit={handleSaveEdit}>
              <label>Full Name<input name="fullName" onChange={updateEditField} required value={editForm.fullName} />{editErrors.fullName && <span className="fieldError">{editErrors.fullName}</span>}</label>
              <label>Position<input name="position" onChange={updateEditField} required value={editForm.position} />{editErrors.position && <span className="fieldError">{editErrors.position}</span>}</label>
              <label>
                Jurisdiction
                <select name="jurisdiction" onChange={updateEditField} required value={editForm.jurisdiction}>
                  <option value="NATIONAL">NATIONAL</option>
                  <option value="CEBU_CITY">CEBU_CITY</option>
                </select>
                {editErrors.jurisdiction && <span className="fieldError">{editErrors.jurisdiction}</span>}
              </label>
              <label>Party / Affiliation<input name="partyAffiliation" onChange={updateEditField} value={editForm.partyAffiliation} /></label>
              <label>Profile Image URL<input name="profileImageUrl" onChange={updateEditField} type="url" value={editForm.profileImageUrl} /></label>
              <label>Biography<textarea name="biography" onChange={updateEditField} rows="5" value={editForm.biography} /></label>
              <div className="editModalActions">
                <button onClick={() => setIsEditOpen(false)} type="button">Cancel</button>
                <button type="submit">Save Update</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Politician Profile Page                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
function PoliticianProfilePage({ onAddContribution, onPoliticianUpdate, onReload, politicianId, politicians, state }) {
  const fallbackProfile = politicians.find((p) => p.politicianId === politicianId) || null
  const profile = state.data || fallbackProfile
  const timelineEntries = state.data?.publishedTimelineLedger || state.data?.timeline || state.data?.entries || []
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({ biography: '', fullName: '', jurisdiction: '', partyAffiliation: '', position: '', profileImageUrl: '' })

  function openEditModal() {
    if (!profile) return
    setEditErrors({})
    setEditForm({
      biography: profile.biography || '', fullName: profile.fullName || '',
      jurisdiction: profile.jurisdiction || '', partyAffiliation: profile.partyAffiliation || '',
      position: profile.position || '', profileImageUrl: profile.profileImageUrl || '',
    })
    setIsEditOpen(true)
  }

  function updateEditField(e) { const { name, value } = e.target; setEditForm((c) => ({ ...c, [name]: value })) }

  function validateEditForm() {
    const errors = {}
    if (!editForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!editForm.position.trim()) errors.position = 'Position is required.'
    if (!editForm.jurisdiction.trim()) errors.jurisdiction = 'Jurisdiction is required.'
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!profile || !validateEditForm()) return
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
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.message || 'Failed to save updates.'); return }
      const savedData = await readApiResponse(res)
      onPoliticianUpdate(profile.politicianId, savedData)
      setIsEditOpen(false)
      await onReload(profile.politicianId)
    } catch (err) { alert('Network error: Could not save updates.') }
  }

  if (!politicianId) {
    return <section className="workspace"><p className="emptyState">Select a politician card first.</p></section>
  }

  return (
    <section className="workspace">
      <StatusLine state={state} />
      {state.status === 'loading' && <PageSectionLoader />}
      {state.status === 'loading' && !profile && <ProfileSkeleton />}
      {profile && (
        <>
          <section className="profileSummary">
            <p className="eyebrow ty-page-kicker">{profile.position || 'UNKNOWN'}</p>
            <h2 className="ty-section-title">{profile.fullName}</h2>
            <p className="ty-body">{profile.jurisdiction || 'Unspecified jurisdiction'}</p>
            <p className="ty-body">{profile.partyAffiliation || 'Party affiliation unavailable'}</p>
          </section>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={openEditModal} type="button">Edit Profile</button>
            <button onClick={() => onAddContribution(profile.politicianId)} type="button">Add Contribution</button>
          </div>
          <KpiGrid profile={profile} />
          <section className="biographyBlock" style={{ marginTop: '16px' }}>
            <h2 className="ty-section-title">Biography</h2>
            <p className="ty-body">{profile.biography || 'No biography available.'}</p>
          </section>
          <TimelineLedger entries={timelineEntries} title="Published Contribution Timeline" />
        </>
      )}

      {isEditOpen && (
        <div aria-hidden="true" className="detailsModalBackdrop" onClick={() => setIsEditOpen(false)}>
          <section aria-label="Edit politician" aria-modal="true" className="editModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="detailsModalHeader">
              <h3 className="ty-section-title">Edit Politician</h3>
              <button onClick={() => setIsEditOpen(false)} type="button">Close</button>
            </header>
            <form className="editFormGrid" onSubmit={handleSaveEdit}>
              <label>Full Name<input name="fullName" onChange={updateEditField} required value={editForm.fullName} />{editErrors.fullName && <span className="fieldError">{editErrors.fullName}</span>}</label>
              <label>Position<input name="position" onChange={updateEditField} required value={editForm.position} />{editErrors.position && <span className="fieldError">{editErrors.position}</span>}</label>
              <label>
                Jurisdiction
                <select name="jurisdiction" onChange={updateEditField} required value={editForm.jurisdiction}>
                  <option value="NATIONAL">NATIONAL</option>
                  <option value="CEBU_CITY">CEBU_CITY</option>
                </select>
                {editErrors.jurisdiction && <span className="fieldError">{editErrors.jurisdiction}</span>}
              </label>
              <label>Party / Affiliation<input name="partyAffiliation" onChange={updateEditField} value={editForm.partyAffiliation} /></label>
              <label>Profile Image URL<input name="profileImageUrl" onChange={updateEditField} type="url" value={editForm.profileImageUrl} /></label>
              <label>Biography<textarea name="biography" onChange={updateEditField} rows="5" value={editForm.biography} /></label>
              <div className="editModalActions">
                <button onClick={() => setIsEditOpen(false)} type="button">Cancel</button>
                <button type="submit">Save Update</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Comparison Panel                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
function ComparisonPanel({ compareIds, onChange, onSubmit, politicians, politiciansState, state }) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pageLeft, setPageLeft] = useState(1)
  const [pageRight, setPageRight] = useState(1)
  const pageSize = 5

  const filteredPoliticians = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((p) => {
      const matchesJ = jurisdictionFilter === 'ALL' || p.jurisdiction === jurisdictionFilter
      const matchesQ = !q || p.fullName.toLowerCase().includes(q) || (p.position || '').toLowerCase().includes(q)
      return matchesJ && matchesQ
    })
  }, [jurisdictionFilter, politicians, query])

  useEffect(() => {
    setPageLeft(1)
    setPageRight(1)
  }, [query, jurisdictionFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPoliticians.length / pageSize))
  const safeLeft = Math.min(pageLeft, totalPages)
  const safeRight = Math.min(pageRight, totalPages)
  const leftSlice = filteredPoliticians.slice((safeLeft - 1) * pageSize, safeLeft * pageSize)
  const rightSlice = filteredPoliticians.slice((safeRight - 1) * pageSize, safeRight * pageSize)

  const selectedCandidateA = politicians.find((p) => p.politicianId === compareIds.idA)
  const selectedCandidateB = politicians.find((p) => p.politicianId === compareIds.idB)
  const compareDisabled = state.status === 'loading' || !compareIds.idA || !compareIds.idB

  useEffect(() => {
    if (!isModalOpen) return undefined
    function handleEscape(e) { if (e.key === 'Escape') setIsModalOpen(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', handleEscape) }
  }, [isModalOpen])

  function selectCandidate(side, id) {
    if (side === 'left') onChange((c) => ({ ...c, idA: id }))
    else onChange((c) => ({ ...c, idB: id }))
  }

  async function handleCompareSubmit(e) {
    const result = await onSubmit(e)
    if (result?.ok) setIsModalOpen(true)
  }

  return (
    <section className="workspace compareWorkspace">

      <section className="compareFilterBar" aria-label="Candidate filters">
        <label>
          Search candidate
          <input name="candidateSearch" onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or position" type="text" value={query} />
        </label>
        <label>
          Jurisdiction
          <select name="jurisdiction" onChange={(e) => setJurisdictionFilter(e.target.value)} value={jurisdictionFilter}>
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="CEBU_CITY">Cebu City</option>
          </select>
        </label>
      </section>

      <StatusLine state={state} />
      <StatusLine state={politiciansState} />

      <div className="compareResultsMeta">
        <p className="ty-meta">Showing {filteredPoliticians.length} candidate{filteredPoliticians.length === 1 ? '' : 's'}</p>
      </div>

      <div className="compareSelectionGrid">
        {['left', 'right'].map((side) => {
          const page = side === 'left' ? safeLeft : safeRight
          const onPage = side === 'left' ? setPageLeft : setPageRight
          const slice = side === 'left' ? leftSlice : rightSlice
          return (
          <section key={side} className={`compareColumn${side === 'right' ? ' right' : ''}`} aria-label={`Candidate ${side === 'left' ? 'A' : 'B'}`}>
            <div className="compareColumnHeader">
              <div>
                <p className="compareColumnTitle">Candidate {side === 'left' ? 'A' : 'B'}</p>
                <p className="ty-meta">Page {page} of {totalPages}</p>
              </div>
              <PaginationMini page={page} totalPages={totalPages} onChange={onPage} />
            </div>
            <div className="compareCardList">
              {filteredPoliticians.length === 0 && <p className="emptyState">No candidates found.</p>}
              {slice.map((p) => {
                const selectedId = side === 'left' ? compareIds.idA : compareIds.idB
                return (
                  <button
                    className={selectedId === p.politicianId ? 'compareCard selected' : 'compareCard'}
                    key={`${side}-${p.politicianId}`}
                    onClick={() => selectCandidate(side, p.politicianId)}
                    type="button"
                  >
                    <span className="compareCardAvatar">
                      {p.profileImageUrl ? <img alt={p.fullName} src={p.profileImageUrl} /> : initialsFor(p.fullName)}
                    </span>
                    <span className="compareCardBody">
                      <strong className="ty-card-title">{p.fullName}</strong>
                      <small className="ty-meta">{p.position || 'UNKNOWN'}</small>
                      <small className="ty-meta">{p.jurisdiction || 'Unspecified'}</small>
                    </span>
                    <span className="selectDot" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </section>
        )})}
      </div>

      <form className="compareFloatingBar" onSubmit={handleCompareSubmit}>
        <div className="compareFloatingContent">
          <div className="compareCandidateSummary">
            <p className="ty-label">Candidate A</p>
            <strong>{selectedCandidateA?.fullName || 'Not selected'}</strong>
          </div>

          <span className="compareDivider" aria-hidden="true" />

          <button disabled={compareDisabled} type="submit" className="compareSubmitButton">
            <ScaleIcon size={18} />
            <span>{state.status === 'loading' ? 'Comparing...' : 'Compare Selected'}</span>
          </button>

          <span className="compareDivider" aria-hidden="true" />

          <div className="compareCandidateSummary right">
            <p className="ty-label">Candidate B</p>
            <strong>{selectedCandidateB?.fullName || 'Not selected'}</strong>
          </div>
        </div>
      </form>

      {isModalOpen && state.data && (
        <div aria-hidden="true" className="comparisonModalBackdrop" onClick={() => setIsModalOpen(false)}>
          <section aria-label="Comparison results" aria-modal="true" className="comparisonModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="comparisonModalHeader">
              <h2 className="ty-section-title">Comparison Result</h2>
              <button aria-label="Close" className="comparisonModalClose" onClick={() => setIsModalOpen(false)} type="button">Close</button>
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
        <h2 className="ty-section-title">Aligned Evidence Ledger</h2>
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
      <p className="eyebrow ty-page-kicker">{profile.position}</p>
      <h2 className="ty-section-title">{profile.fullName}</h2>
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
          <span className="ty-label">{label}</span>
          <strong>{value ?? 'N/A'}</strong>
        </article>
      ))}
    </section>
  )
}

function TimelineLedger({ entries, compact = false, title = 'Published Timeline Ledger' }) {
  return (
    <section className={compact ? 'timeline compact' : 'timeline'}>
      <h2 className="ty-section-title">{title}</h2>
      {entries.length === 0 && <p className="emptyState">No published records returned.</p>}
      {entries.map((entry) => (
        <article className="timelineItem" key={entry.timelineId || `${entry.categoryTag}-${entry.createdAt}`}>
          <div>
            <strong>{entry.actionIdentifier}</strong>
            <span style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--line-soft)',
              borderRadius: 'var(--radius-full)',
              fontFamily: 'var(--mono, monospace)',
              fontSize: '11px',
              fontWeight: '500',
              letterSpacing: '0.04em',
              padding: '2px 8px',
              color: 'var(--text-muted)',
            }}>{entry.categoryTag}</span>
          </div>
          <p className="ty-body">{entry.summary}</p>
          <a href={entry.sourceUrl} rel="noreferrer" target="_blank">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              View Source <ExternalLinkIcon size={14} />
            </span>
          </a>
        </article>
      ))}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Shared primitives                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
function Field({ label, name, onChange, required = true, type = 'text', value }) {
  return (
    <label>
      {label}
      <input name={name} required={required} type={type} value={value} onChange={onChange} />
    </label>
  )
}

function PaginationMini({ page, totalPages, onChange }) {
  const disabledPrev = page <= 1
  const disabledNext = page >= totalPages
  return (
    <nav className="paginationMini" aria-label="Pagination">
      <button
        type="button"
        disabled={disabledPrev}
        onClick={() => onChange((p) => Math.max(1, p - 1))}
        className="paginationButton"
        aria-label="Previous page"
      >
        <ArrowLeftIcon size={17} strokeWidth={2.4} />
      </button>
      <span className="paginationText" aria-live="polite">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={disabledNext}
        onClick={() => onChange((p) => Math.min(totalPages, p + 1))}
        className="paginationButton"
        aria-label="Next page"
      >
        <ArrowRightIcon size={17} strokeWidth={2.4} />
      </button>
    </nav>
  )
}

function Fact({ label, value }) {
  return (
    <article className="factItem">
      <span className="ty-label">{label}</span>
      <strong>{value || 'Unavailable'}</strong>
    </article>
  )
}

function StatusLine({ state }) {
  if (!state.message) return null
  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-100 border-t-blue-500" aria-hidden="true" />
          <span className="sr-only">{state.message}</span>
          <div className="h-2 w-40 rounded-full bg-slate-100 animate-pulse" aria-hidden="true" />
        </div>
      </div>
    )
  }
  return <p className={`statusLine ${state.status}`}>{state.message}</p>
}

function LoadingSkeletonCards({ count = 4 }) {
  return (
    <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <article
          className="grid min-h-[142px] grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5"
          key={`s-${i}`}
        >
          <span className="h-[88px] w-[88px] rounded-xl bg-slate-100 animate-pulse" />
          <div className="space-y-2.5">
            <span className="block h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
            <span className="block h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
            <span className="block h-3 w-3/5 rounded bg-slate-100 animate-pulse" />
          </div>
        </article>
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" aria-hidden="true" />
          <span className="text-sm font-medium">Loading profile</span>
        </div>
      </div>
      <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-5 max-md:grid-cols-1">
        <div className="h-[132px] w-[132px] rounded-xl bg-slate-100 animate-pulse" />
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-7 w-2/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4" key={i}>
            <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  )
}

function PageSectionLoader() {
  return (
    <section className="flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-xs" aria-live="polite">
      <div className="flex items-center gap-3 text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-wide">Loading content</span>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  My Contributions Panel                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
function MyContributionsPanel({ user }) {
  const [contributions, setContributions] = useState([])
  const [state, setState] = useState({ status: 'loading', message: 'Retrieving your contribution history...' })

  useEffect(() => {
    if (!user?.userId) {
      setContributions([])
      setState({ status: 'error', message: 'Unable to load contribution history without a user id.' })
      return
    }

    fetch(`${API_BASE_URL}/api/submissions/contributor/${user.userId}`)
      .then(readApiResponse)
      .then((data) => {
        setContributions(Array.isArray(data) ? data : [])
        setState({ status: 'success', message: '' })
      })
      .catch((err) => {
        setContributions([])
        setState({ status: 'error', message: err.message })
      })
  }, [user?.userId])

  const STAGES = ['SUBMITTED', 'JURY REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED']

  function stageIndexFor(status) {
    switch ((status || '').toUpperCase()) {
      case 'SUBMITTED': case 'PENDING': return 0
      case 'JURY_REVIEW': return 1
      case 'ESCALATED': case 'REVISION_REQUIRED': return 2
      case 'REJECTED': return 3
      case 'PUBLISHED': return 4
      default: return 0
    }
  }

  return (
    <section className="workspace">
      <section className="dashboardHeaderBlock">
        <h2 className="ty-section-title">My Contributions</h2>
        <p className="ty-body">Track the verification lifecycle of your submitted political records.</p>
      </section>

      <StatusLine state={state} />

      <div style={{ display: 'grid', gap: '16px' }}>
        {state.status !== 'loading' && contributions.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '48px 32px',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--line-strong)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <p className="ty-body" style={{ color: 'var(--text-muted)' }}>
              No contributions yet. Head to <strong>File Evidence</strong> to submit your first record.
            </p>
          </div>
        )}

        {contributions.map((item) => {
          const activeStage = stageIndexFor(item.status)
          const isRejected = item.status === 'REJECTED'
          return (
            <article key={item.submissionId} className="review-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  background: 'var(--info-soft)',
                  color: 'var(--info)',
                  border: '1px solid var(--info-border)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--mono, monospace)',
                  fontSize: '11px',
                  fontWeight: '500',
                  letterSpacing: '0.04em',
                }}>
                  #{item.submissionId.substring(0, 8).toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                  {formatDate(item.createdAt)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                {[
                  ['Category', item.categoryTag],
                  ['Action Tag', item.actionIdentifier],
                  ['Metric', formatActionMetric(item.actionDetails, item.actionIdentifier)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="ty-label" style={{ display: 'block', marginBottom: '3px' }}>{k}</span>
                    <strong style={{ fontFamily: 'var(--display)', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{v}</strong>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--line-hairline)',
                borderLeft: '3px solid var(--line-strong)',
                padding: '12px 16px',
                borderRadius: '0 var(--radius-xs) var(--radius-xs) 0',
                fontStyle: 'italic',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: '1.65',
              }}>
                "{item.impactSummary}"
              </div>

              <div>
                <span className="ty-label" style={{ display: 'inline', marginRight: '6px' }}>Source</span>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{
                  fontFamily: 'var(--mono, monospace)',
                  fontSize: '12px',
                  color: 'var(--info)',
                  fontWeight: '500',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--info-border)',
                }}>
                  {item.sourceUrl}
                </a>
              </div>

              <div style={{ marginTop: '4px', paddingTop: '16px', borderTop: '1px dashed var(--line-soft)' }}>
                <span className="ty-label" style={{ display: 'block', marginBottom: '10px' }}>Lifecycle Stage</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
                  {STAGES.map((stage, index) => {
                    const isPast = index <= activeStage
                    const isActive = index === activeStage
                    const stageLabel = stage === 'FINALIZED' && isRejected ? 'REJECTED' : stage
                    return (
                      <span key={stage} style={{
                        textAlign: 'center',
                        padding: '6px 4px',
                        borderRadius: 'var(--radius-full)',
                        fontFamily: 'var(--mono, monospace)',
                        fontSize: '10px',
                        fontWeight: '600',
                        letterSpacing: '0.04em',
                        border: `1px solid ${isPast ? (isRejected && index === 3 ? 'var(--danger-border)' : 'var(--ph-blue)') : 'var(--line-soft)'}`,
                        background: isPast
                          ? (isRejected && index === 3 ? 'var(--danger)' : 'var(--ph-blue)')
                          : 'var(--bg-inset)',
                        color: isPast ? '#ffffff' : 'var(--text-subtle)',
                        opacity: isPast ? 1 : 0.6,
                        boxShadow: isActive ? '0 0 0 2px rgba(10,29,66,0.15)' : 'none',
                        transition: 'all 200ms ease',
                      }}>
                        {stageLabel}
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

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Utilities                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
function initialsFor(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0))
}

function formatActionMetric(actionDetails, actionIdentifier) {
  if (!actionDetails) return 'N/A'
  switch (actionIdentifier) {
    case 'COA_FINDING':
      return formatCurrency(actionDetails.flaggedAmount)
    case 'BUDGET_ALLOCATION':
      return formatCurrency(actionDetails.allocationAmount)
    case 'PROJECT_COMPLETION':
      return `${Number(actionDetails.completionPercentage || 0).toLocaleString('en-PH')}% Completed`
    case 'SPONSORED_LEGISLATION':
      return [
        actionDetails.legislationTitle,
        actionDetails.legislativeStatus,
        formatDate(actionDetails.dateFiled),
      ].filter(Boolean).join(' | ') || 'Legislation details'
    default:
      return actionDetails.metric !== undefined ? String(actionDetails.metric) : 'View Details'
  }
}

function normalizeActionDetails(actionDetails = {}) {
  return Object.fromEntries(
    Object.entries(actionDetails)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => {
        const numericValue = Number(value)
        return Number.isFinite(numericValue) && value !== null && value !== '' ? [key, numericValue] : [key, value]
      }),
  )
}

function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

export default App
