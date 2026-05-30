import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ModerationPanel from './components/ModerationPanel'
import UserProfileMatrixPanel from './components/UserProfileMatrixPanel'
import TrustScoreMeter from './components/TrustScoreMeter'
import ConfirmActionModal from './components/ConfirmActionModal'
import PoliticianRankingPanel from './components/PoliticianRankingPanel'
import LifecycleStageStrip from './components/LifecycleStageStrip'
import { matchesJurisdiction } from './components/jurisdiction'
import { ContributionCardsSkeleton, TimelineCardsSkeleton } from './components/Skeletons'
import { clampTrustScore } from './components/trustScore'
import { DeveloperSandboxProvider } from './developer/DeveloperSandboxProvider'
import { useDeveloperSandbox } from './developer/DeveloperSandboxContext'
import DeveloperOptionsPanel from './developer/DeveloperOptionsPanel'
import { useAuth } from './auth/AuthContext'
import AuthPages from './auth/AuthPages'
import TopNav from './components/TopNav'
import UserHistoryPage from './components/UserHistoryPage'

// Decoupled Module 1 Components
import EditSubmissionForm from './components/module1/EditSubmissionForm'
import PoliticianDashboard from './components/module1/PoliticianDashboard'
import TimelineLedgerDecoupled from './components/module1/TimelineLedger'
import KPIWidget from './components/module1/KPIWidget'
import { POSITION_OPTIONS } from './components/module1/positionConfig'
import './components/module1/Module1.css'
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
  UserPlusIcon,
  UsersIcon,
} from './components/icons/Lucide'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

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

function AppInner({ currentUser, onLogout, onUserUpdate, token }) {
  const sandboxContext = useDeveloperSandbox()
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null
  const [resolvedUser, setResolvedUser] = useState(currentUser || null)
  const activeUser = isDevModeActive && manipulatedUser ? manipulatedUser : resolvedUser
  const currentRole = activeUser?.role || 'CONTRIBUTOR';

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
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false)
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false)
  const [isApprovedDomain, setIsApprovedDomain] = useState(false)

  const activeHeader = {
    account: ['Account', 'User Account'],
    compare: ['Compare', 'Compare Politicians'],
    contributions: ['Submissions', 'My Contribution Ledger'],
    dashboard: ['Dashboard', 'Source-First Profile Aggregator'],
    directory: ['Directory', 'Politician Directory'],
    history: ['History', 'Reputation Change Ledger'],
    moderation: ['Moderation', 'Judicial Moderation Engine'],
    profile: ['Profiles', 'Published Profile Dashboard'],
    profileMatrix: isDevModeActive
      ? ['Developer Sandbox', 'Core Profile Metrics Matrix']
      : ['My Profile', 'Contribution Metrics'],
    submit: ['Submissions', 'Evidence Submission Console'],
  }[activeView] || ['Dashboard', 'Source-First Profile Aggregator']

  const headerTitleHiddenFor = new Set(['dashboard', 'directory', 'compare', 'contributions', 'submit', 'moderation'])
  const showHeaderTitles = !headerTitleHiddenFor.has(activeView)

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

  useEffect(() => {
    let cancelled = false
    if (!token) return () => { cancelled = true }
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(readApiResponse)
      .then((data) => {
        if (cancelled || !data) return
        setResolvedUser(data)
        onUserUpdate?.(data)
      })
      .catch(() => null)
    return () => { cancelled = true }
  }, [token, onUserUpdate])

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
      setIsApprovedDomain(false)
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

  function handlePoliticianLocalCreate(newPolitician) {
    setPoliticiansState((current) => {
      const nextData = [newPolitician, ...current.data.filter((p) => p.politicianId !== newPolitician.politicianId)]
      return { ...current, data: nextData, selected: current.selected || newPolitician }
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

  const isAnyModalOpen = isCompareModalOpen || isAppealModalOpen || isDirectoryModalOpen

  return (
    <main className="appShell">
      <TopNav
        activeView={activeView}
        isCompareModalOpen={isCompareModalOpen}
        isModalOpen={isAnyModalOpen}
        onLogout={onLogout}
        onSelectView={setActiveView}
        title="PolitikApp"
        user={activeUser}
      />

      <section className={isAnyModalOpen ? 'pageContent pt-0' : 'pageContent pt-32 sm:pt-36'}>
        {!isAnyModalOpen && (
          <header className="topBar">
              <div className="flex items-center gap-3">
                {showHeaderTitles && (
                  <>
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--ph-blue)] ring-1 ring-black/5">
                      <span className="ty-nav font-extrabold" aria-hidden="true">
                        {activeHeader[0]?.slice(0, 1) || 'P'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="ty-label">{activeHeader[0]}</p>
                      <p className="ty-nav truncate text-[color:var(--text-primary)]">{activeHeader[1]}</p>
                    </div>
                  </>
                )}
            </div>
          </header>
        )}

        {activeView === 'directory' && (
          <PoliticianDirectoryLoaderPanel
            dashboardId={dashboardId}
            dbUser={currentUser}
            onChange={setDashboardId}
            onViewProfile={openPoliticianProfile}
            onSubmit={handleDashboardLookup}
            politicians={politiciansState.data}
            politiciansState={politiciansState}
            state={dashboardState}
            onPoliticianUpdate={handlePoliticianLocalUpdate}
            onPoliticianCreate={handlePoliticianLocalCreate}
            onModalOpenChange={setIsDirectoryModalOpen}
            token={token}
          />
        )}
        {activeView === 'submit' && (
          <SubmissionPanel
            formData={formData}
            onChange={updateFormField}
            onDetailChange={updateActionDetail}
            onDomainCheck={setIsApprovedDomain}
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
            onUserUpdate={onUserUpdate}
            onAppealModalOpenChange={setIsAppealModalOpen}
            politicianId={selectedPoliticianId}
            politicians={politiciansState.data}
            state={dashboardState}
            dbUser={currentUser}
            token={token}
            user={activeUser}
          />
        )}
        {activeView === 'dashboard' && (
          <DashboardPanel
            isLoading={politiciansState.status === 'loading'}
            onNavigate={setActiveView}
            onOpenProfile={openPoliticianProfile}
            politicians={politiciansState.data}
            user={activeUser}
          />
        )}
        {activeView === 'compare' && (
          <ComparisonPanel
            compareIds={compareIds}
            onChange={setCompareIds}
            onModalOpenChange={setIsCompareModalOpen}
            onSubmit={handleComparisonLookup}
            politicians={politiciansState.data}
            politiciansState={politiciansState}
            state={comparisonState}
          />
        )}
        {activeView === 'contributions' && <MyContributionsPanel onNavigateToSubmit={() => setActiveView('submit')} user={activeUser} />}
        {activeView === 'profileMatrix' && <UserProfileMatrixPanel token={token} user={activeUser} />}
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
            <ModerationPanel token={token} user={activeUser} />
          )
        )}
        {activeView === 'account' && <UserAccountPage token={token} user={activeUser} />}
        {activeView === 'history' && <UserHistoryPage token={token} />}
      </section>
    </main>
  )
}

function App() {
  const { isAuthenticated, logout, token, updateSession, user } = useAuth()
  if (!isAuthenticated) return <AuthPages />
  return (
    <DeveloperSandboxProvider currentUser={user} token={token}>
      <AppInner currentUser={user} onLogout={logout} onUserUpdate={updateSession} token={token} />
      {/* <DeveloperOptionsPanel /> */}
    </DeveloperSandboxProvider>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Dashboard                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
function DashboardPanel(props) {
  return <PoliticianDashboard {...props} />
}
function UserAccountPage({ token, user }) {
  const { updateSession } = useAuth()
  const [profile, setProfile] = useState(null)
  const [state, setState] = useState({ status: 'loading', message: 'Loading profile...' })
  const [form, setForm] = useState({ fullName: '', username: '' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', message: 'Loading profile...' })
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(readApiResponse)
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        setForm({ fullName: data.fullName || '', username: data.username || '' })
        setState({ status: 'success', message: '' })
      })
      .catch((error) => {
        if (cancelled) return
        setState({ status: 'error', message: error.message || 'Failed to load profile.' })
      })
    return () => { cancelled = true }
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
      setProfile(data.user || data)
      updateSession(data)
      setState({ status: 'success', message: 'Profile updated.' })
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }

  return (
    <section className="workspace">
      <section className="profileSummary">
        <p className="eyebrow ty-page-kicker">Account</p>
        <h2 className="ty-section-title">{profile?.fullName || user?.fullName || '—'}</h2>
        <p className="ty-body">{profile?.email || user?.email || '—'}</p>
        <p className="ty-body">Role: {profile?.role || user?.role || '—'}</p>
        <div style={{ marginTop: '16px', maxWidth: '420px' }}>
          <TrustScoreMeter score={profile?.trustScore ?? user?.trustScore ?? 0} />
        </div>
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
function SubmissionPanel(props) {
  return <EditSubmissionForm {...props} />
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Politician Directory                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
function PoliticianDirectoryLoaderPanel({
  dashboardId, dbUser, onChange, onViewProfile, onSubmit,
  politicians, politiciansState, state, onModalOpenChange, onPoliticianUpdate, onPoliticianCreate, token,
}) {
  const [query, setQuery] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 9
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createState, setCreateState] = useState({ status: 'idle', message: '' })
  const [createErrors, setCreateErrors] = useState({})
  const [detailsData, setDetailsData] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({
    biography: '', fullName: '', jurisdiction: '',
    partyAffiliation: '', position: '', profileImageUrl: '',
  })
  const [createForm, setCreateForm] = useState({
    fullName: '',
    jurisdiction: '',
    partyAffiliation: '',
    position: '',
    biography: '',
    profileImageUrl: '',
    status: '',
    termStart: '',
    termEnd: '',
  })
  const isDatabaseAdmin = dbUser?.role === 'ADMIN'

  const filteredPoliticians = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((p) => {
      const jurisdictionMatch = matchesJurisdiction(p.jurisdiction, jurisdictionFilter)
      const matchesQuery = !q || p.fullName.toLowerCase().includes(q) || (p.position || '').toLowerCase().includes(q)
      return jurisdictionMatch && matchesQuery
    })
  }, [jurisdictionFilter, politicians, query])

  useEffect(() => {
    setPage(1)
  }, [query, jurisdictionFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPoliticians.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedPoliticians = filteredPoliticians.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    if (!isDetailsOpen && !isEditOpen && !isCreateOpen) return undefined
    function handleEscape(e) {
      if (e.key === 'Escape') { setIsCreateOpen(false); setIsEditOpen(false); setIsDetailsOpen(false) }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', handleEscape) }
  }, [isDetailsOpen, isEditOpen, isCreateOpen])

  useEffect(() => {
    onModalOpenChange?.(isDetailsOpen || isEditOpen || isCreateOpen)
    return () => onModalOpenChange?.(false)
  }, [isDetailsOpen, isEditOpen, isCreateOpen, onModalOpenChange])

  async function handleCardSelect(politician) {
    await onViewProfile(politician.politicianId)
  }

  function openCreateModal() {
    if (!isDatabaseAdmin) return
    setCreateErrors({})
    setCreateState({ status: 'idle', message: '' })
    setCreateForm({
      fullName: '',
      jurisdiction: '',
      partyAffiliation: '',
      position: '',
      biography: '',
      profileImageUrl: '',
      status: '',
      termStart: '',
      termEnd: '',
    })
    setIsCreateOpen(true)
  }

  function openEditModal() {
    if (!detailsData || !isDatabaseAdmin) return
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

  function updateCreateField(e) {
    const { name, value } = e.target
    setCreateForm((current) => ({ ...current, [name]: value }))
  }

  function validateEditForm() {
    const errors = {}
    if (!editForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!editForm.position.trim()) errors.position = 'Position is required.'
    if (!editForm.jurisdiction.trim()) errors.jurisdiction = 'Jurisdiction is required.'
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateCreateForm() {
    const errors = {}
    if (!createForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!createForm.jurisdiction.trim()) errors.jurisdiction = 'Jurisdiction is required.'
    if (!createForm.position.trim()) errors.position = 'Position is required.'
    if (!createForm.status.trim()) errors.status = 'Status is required.'
    if (!createForm.termStart) errors.termStart = 'Term start is required.'
    if (!createForm.termEnd) errors.termEnd = 'Term end is required.'
    if (createForm.termStart && createForm.termEnd && new Date(createForm.termEnd) < new Date(createForm.termStart)) {
      errors.termEnd = 'Term end cannot be earlier than term start.'
    }
    if (createForm.profileImageUrl.trim()) {
      try {
        new URL(createForm.profileImageUrl.trim())
      } catch {
        errors.profileImageUrl = 'Provide a valid URL for profile image.'
      }
    }
    setCreateErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!detailsData || !isDatabaseAdmin || !validateEditForm()) return
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    } catch {
      alert('Network error: Could not save profile updates.')
    }
  }

  async function handleCreatePolitician(e) {
    e.preventDefault()
    if (!isDatabaseAdmin || !validateCreateForm()) return
    setCreateState({ status: 'loading', message: 'Creating politician profile...' })

    const payload = {
      fullName: createForm.fullName.trim(),
      jurisdiction: createForm.jurisdiction.trim(),
      partyAffiliation: createForm.partyAffiliation.trim(),
      position: createForm.position.trim(),
      biography: createForm.biography.trim(),
      profileImageUrl: createForm.profileImageUrl.trim() || null,
      status: createForm.status.trim(),
      termStart: createForm.termStart,
      termEnd: createForm.termEnd,
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/politicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await readApiResponse(res)
        onPoliticianCreate?.(data)
        setCreateState({ status: 'success', message: 'Politician added successfully.' })
        setIsCreateOpen(false)
        return
      }

      const fallbackPolitician = {
        politicianId: crypto.randomUUID(),
        fullName: payload.fullName,
        jurisdiction: payload.jurisdiction,
        partyAffiliation: payload.partyAffiliation,
        position: payload.position,
        biography: payload.biography,
        profileImageUrl: payload.profileImageUrl,
        status: payload.status,
        termStart: payload.termStart,
        termEnd: payload.termEnd,
        billsAuthored: 0,
        projectCompletions: 0,
        coaAuditDiscrepancies: 0,
        trackedBudgetAllocated: 0,
        legislativeEfficiencyRatio: 0,
      }
      onPoliticianCreate?.(fallbackPolitician)
      setCreateState({ status: 'success', message: 'Create endpoint unavailable. Politician was added locally for this session.' })
      setIsCreateOpen(false)
    } catch {
      setCreateState({ status: 'error', message: 'Network error: could not create politician.' })
    }
  }

  return (
    <section className="workspace dashboardWorkspace">
      <section className="dashboardHeaderBlock">
        <div className="directoryHeaderRow">
          <div>
            <h2 className="ty-section-title">Politician Directory</h2>
            <p className="ty-body">Browse and select a politician to load their performance profile instantly.</p>
          </div>
          {isDatabaseAdmin && (
            <button type="button" className="directoryAddButton" onClick={openCreateModal}>
              <UserPlusIcon size={16} />
              Add Politician
            </button>
          )}
        </div>
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
            {isDatabaseAdmin && (
              <footer className="detailsModalFooter">
                <button onClick={openEditModal} type="button">Edit Profile</button>
              </footer>
            )}
          </section>
        </div>
      )}

      {isEditOpen && (
        <div aria-hidden="true" className="comparisonModalBackdrop" onClick={() => setIsEditOpen(false)}>
          <section aria-label="Edit politician" aria-modal="true" className="comparisonModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="comparisonModalHeader">
              <h3 className="ty-section-title">Edit Politician</h3>
              <button aria-label="Close" className="comparisonModalClose" onClick={() => setIsEditOpen(false)} type="button">Close</button>
            </header>
            <div className="comparisonModalBody">
              <form className="editFormGrid" onSubmit={handleSaveEdit}>
                <label>Full Name<input name="fullName" onChange={updateEditField} required value={editForm.fullName} />{editErrors.fullName && <span className="fieldError">{editErrors.fullName}</span>}</label>
                <label>
                  Position
                  <select name="position" onChange={updateEditField} required value={editForm.position}>
                    <option value="">Select a position</option>
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label} — {opt.jurisdictionLabel}</option>
                    ))}
                  </select>
                  {editErrors.position && <span className="fieldError">{editErrors.position}</span>}
                </label>
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
            </div>
          </section>
        </div>
      )}
      {isCreateOpen && (
        <div aria-hidden="true" className="comparisonModalBackdrop" onClick={() => setIsCreateOpen(false)}>
          <section aria-label="Add politician" aria-modal="true" className="comparisonModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="comparisonModalHeader">
              <h3 className="ty-section-title">Add Politician</h3>
              <button aria-label="Close" className="comparisonModalClose" onClick={() => setIsCreateOpen(false)} type="button">Close</button>
            </header>
            <div className="comparisonModalBody">
              <form className="editFormGrid" onSubmit={handleCreatePolitician}>
                <label>Full Name<input name="fullName" onChange={updateCreateField} required value={createForm.fullName} />{createErrors.fullName && <span className="fieldError">{createErrors.fullName}</span>}</label>
                <label>
                  Position
                  <select name="position" onChange={(e) => {
                    const opt = POSITION_OPTIONS.find((o) => o.value === e.target.value)
                    updateCreateField(e)
                    if (opt) setCreateForm((c) => ({ ...c, position: e.target.value, jurisdiction: opt.jurisdiction }))
                  }} required value={createForm.position}>
                    <option value="">Select a position</option>
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label} — {opt.jurisdictionLabel}</option>
                    ))}
                  </select>
                  {createErrors.position && <span className="fieldError">{createErrors.position}</span>}
                </label>
                <label>
                  Jurisdiction
                  <input name="jurisdiction" readOnly value={createForm.jurisdiction || (POSITION_OPTIONS.find((o) => o.value === createForm.position)?.jurisdictionLabel ?? '')} style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Auto-derived from position</small>
                  {createErrors.jurisdiction && <span className="fieldError">{createErrors.jurisdiction}</span>}
                </label>
                <label>Party Affiliation<input name="partyAffiliation" onChange={updateCreateField} value={createForm.partyAffiliation} />{createErrors.partyAffiliation && <span className="fieldError">{createErrors.partyAffiliation}</span>}</label>
                <label>
                  Status
                  <select name="status" onChange={updateCreateField} required value={createForm.status}>
                    <option value="">Select status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                  {createErrors.status && <span className="fieldError">{createErrors.status}</span>}
                </label>
                <label>Profile Image URL<input name="profileImageUrl" onChange={updateCreateField} type="url" value={createForm.profileImageUrl} />{createErrors.profileImageUrl && <span className="fieldError">{createErrors.profileImageUrl}</span>}</label>
                <label>Term Start<input name="termStart" onChange={updateCreateField} required type="date" value={createForm.termStart} />{createErrors.termStart && <span className="fieldError">{createErrors.termStart}</span>}</label>
                <label>Term End<input name="termEnd" onChange={updateCreateField} required type="date" value={createForm.termEnd} />{createErrors.termEnd && <span className="fieldError">{createErrors.termEnd}</span>}</label>
                <label>Biography<textarea name="biography" onChange={updateCreateField} rows="5" value={createForm.biography} />{createErrors.biography && <span className="fieldError">{createErrors.biography}</span>}</label>
                <StatusLine state={createState} />
                <div className="editModalActions">
                  <button onClick={() => setIsCreateOpen(false)} type="button">Cancel</button>
                  <button disabled={createState.status === 'loading'} type="submit">Create Politician</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
      {createState.message && !isCreateOpen && <StatusLine state={createState} />}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Politician Profile Page                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
function PoliticianProfilePage({ dbUser, onAddContribution, onPoliticianUpdate, onReload, onUserUpdate, onAppealModalOpenChange, politicianId, politicians, state, token, user }) {
  const fallbackProfile = politicians.find((p) => p.politicianId === politicianId) || null
  const profile = state.data || fallbackProfile
  const timelineEntries = state.data?.publishedTimelineLedger || state.data?.timeline || state.data?.entries || []
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [appealTarget, setAppealTarget] = useState(null)
  const [appealState, setAppealState] = useState({ status: 'idle', message: '' })
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({ biography: '', fullName: '', jurisdiction: '', partyAffiliation: '', position: '', profileImageUrl: '' })
  const isDatabaseAdmin = dbUser?.role === 'ADMIN'

  useEffect(() => {
    if (!isEditOpen) return undefined
    function handleEscape(e) {
      if (e.key === 'Escape') setIsEditOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isEditOpen])

  function openEditModal() {
    if (!profile || !isDatabaseAdmin) return
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
    if (!profile || !isDatabaseAdmin || !validateEditForm()) return
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.message || 'Failed to save updates.'); return }
      const savedData = await readApiResponse(res)
      onPoliticianUpdate(profile.politicianId, savedData)
      setIsEditOpen(false)
      await onReload(profile.politicianId)
    } catch { alert('Network error: Could not save updates.') }
  }

  function handleAppeal(entry) {
    if (!entry?.submissionId) {
      setAppealState({ status: 'error', message: 'This timeline record cannot be appealed because it is missing source submission linkage.' })
      return
    }
    onAppealModalOpenChange?.(true)
    setAppealTarget(entry)
  }

  async function confirmAppeal() {
    if (!appealTarget?.submissionId) return
    setAppealState({ status: 'loading', message: 'Filing appeal and routing record to admin adjudication...' })
    try {
      const data = await fetch(`${API_BASE_URL}/api/moderation/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId: appealTarget.submissionId }),
      }).then(readApiResponse)

      if (onUserUpdate) {
        onUserUpdate({ trustScore: data.trustScore })
      }
      setAppealState({ status: 'success', message: data.message || 'Appeal filed.' })
      setAppealTarget(null)
      onAppealModalOpenChange?.(false)
    } catch (error) {
      setAppealState({ status: 'error', message: error.message })
      setAppealTarget(null)
      onAppealModalOpenChange?.(false)
    }
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
            {isDatabaseAdmin && <button onClick={openEditModal} type="button">Edit Profile</button>}
            <button onClick={() => onAddContribution(profile.politicianId)} type="button">Add Contribution</button>
          </div>
          <KpiGrid profile={profile} />
          <section className="biographyBlock" style={{ marginTop: '16px' }}>
            <h2 className="ty-section-title">Biography</h2>
            <p className="ty-body">{profile.biography || 'No biography available.'}</p>
          </section>
          <StatusLine state={appealState} />
          <TimelineLedger entries={timelineEntries} isLoading={state.status === 'loading'} onAppeal={handleAppeal} title="Published Contribution Timeline" user={user} />
        </>
      )}

      {isEditOpen && (
        <div aria-hidden="true" className="comparisonModalBackdrop" onClick={() => setIsEditOpen(false)}>
          <section aria-label="Edit politician" aria-modal="true" className="comparisonModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="comparisonModalHeader">
              <h3 className="ty-section-title">Edit Politician</h3>
              <button aria-label="Close" className="comparisonModalClose" onClick={() => setIsEditOpen(false)} type="button">Close</button>
            </header>
            <div className="comparisonModalBody">
              <form className="editFormGrid" onSubmit={handleSaveEdit}>
                <label>Full Name<input name="fullName" onChange={updateEditField} required value={editForm.fullName} />{editErrors.fullName && <span className="fieldError">{editErrors.fullName}</span>}</label>
                <label>
                  Position
                  <select name="position" onChange={updateEditField} required value={editForm.position}>
                    <option value="">Select a position</option>
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label} — {opt.jurisdictionLabel}</option>
                    ))}
                  </select>
                  {editErrors.position && <span className="fieldError">{editErrors.position}</span>}
                </label>
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
            </div>
          </section>
        </div>
      )}
      <ConfirmActionModal
        cancelLabel="Cancel"
        confirmLabel="File Appeal"
        description="This will immediately deduct 10.00 trust points. If the appeal fails, an additional 20.00 points will be deducted."
        isOpen={Boolean(appealTarget)}
        isSubmitting={appealState.status === 'loading'}
        onCancel={() => {
          setAppealTarget(null)
          onAppealModalOpenChange?.(false)
        }}
        onConfirm={confirmAppeal}
        severity="warning"
        title="File Post-Publish Appeal?"
      />
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Comparison Panel                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
function ComparisonPanel({ compareIds, onChange, onModalOpenChange, onSubmit, politicians, politiciansState, state }) {
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

  useEffect(() => {
    onModalOpenChange?.(isModalOpen)
    return () => onModalOpenChange?.(false)
  }, [isModalOpen, onModalOpenChange])

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
            <div className="comparisonModalBody">
              <ComparisonGrid comparison={state.data} />
            </div>
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
            <div className="compareLedgerPair">
              <TimelineLedger className="comparisonLedgerCard" entries={row.recordsA || []} title="Candidate A" />
              <TimelineLedger className="comparisonLedgerCard" entries={row.recordsB || []} title="Candidate B" />
            </div>
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

function KpiGrid(props) {
  return <KPIWidget {...props} />
}

function TimelineLedger(props) {
  return <TimelineLedgerDecoupled {...props} />
}

function TrustDeltaBadge({ entry }) {
  const status = String(entry.publicationStatus || entry.status || '').toUpperCase()
  const delta = status === 'PUBLISHED' ? 15 : status === 'REJECTED' ? -20 : 0
  if (!delta) return null
  const isPositive = delta > 0
  return (
    <span
      title="Trust score impact indicator"
      style={{
        background: isPositive ? 'var(--success-soft)' : 'var(--danger-soft)',
        border: `1px solid ${isPositive ? 'var(--success-border)' : 'var(--danger-border)'}`,
        borderRadius: 'var(--radius-full)',
        fontFamily: 'var(--mono, monospace)',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.02em',
        padding: '2px 8px',
        color: isPositive ? 'var(--success)' : 'var(--danger)',
      }}
    >
      {isPositive ? `+${delta}` : `${delta}`} Trust
    </span>
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

function CursorHint({ hoverInfo }) {
  const hintRef = useRef(null)
  const [position, setPosition] = useState({ left: -9999, top: -9999 })

  useEffect(() => {
    if (!hoverInfo?.x || !hoverInfo?.y || !hintRef.current) return
    const tooltipRect = hintRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const offsetX = 6
    const offsetY = 8
    const margin = 6

    let left = hoverInfo.x + offsetX
    let top = hoverInfo.y + offsetY

    if (left + tooltipRect.width > viewportWidth - margin) {
      left = hoverInfo.x - tooltipRect.width - offsetX
    }
    if (top + tooltipRect.height > viewportHeight - margin) {
      top = hoverInfo.y - tooltipRect.height - offsetY
    }

    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin))
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin))
    setPosition({ left, top })
  }, [hoverInfo])

  if (!hoverInfo?.x || !hoverInfo?.y) return null
  return (
    <div ref={hintRef} aria-hidden="true" className="cursorHint" style={{ left: `${position.left}px`, top: `${position.top}px` }}>
      <strong>{hoverInfo.title}</strong>
      <span>{hoverInfo.description}</span>
      {hoverInfo.hint ? <small>{hoverInfo.hint}</small> : null}
    </div>
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
function MyContributionsPanel({ onNavigateToSubmit, user }) {
  const [contributions, setContributions] = useState([])
  const [state, setState] = useState({ status: 'loading', message: 'Retrieving your contribution history...' })
  const [page, setPage] = useState(1)

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

  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(contributions.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = contributions.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => { setPage(1) }, [contributions.length])

  return (
    <section className="workspace">
      <section className="dashboardHeaderBlock">
        <h2 className="ty-section-title">My Contributions</h2>
        <p className="ty-body">Track the verification lifecycle of your submitted political records.</p>
        <div>
          <button type="button" onClick={() => onNavigateToSubmit?.()}>
            Submit Official Audit Record
          </button>
        </div>
      </section>

      <StatusLine state={state} />

      <div className="myContribGrid">
        {state.status === 'loading' && <ContributionCardsSkeleton count={4} />}
        {state.status !== 'loading' && contributions.length === 0 && (
          <div className="myContribEmpty">
            <p className="ty-body" style={{ color: 'var(--text-muted)' }}>No contributions yet. Head to <strong>File Evidence</strong> to submit your first record.</p>
          </div>
        )}

        {pageItems.map((item) => {
          return (
            <article key={item.submissionId} className="review-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: 'var(--info-soft)', color: 'var(--info)', border: '1px solid var(--info-border)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontFamily: 'var(--mono, monospace)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.04em' }}>#{item.submissionId.substring(0, 8).toUpperCase()}</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <TrustDeltaBadge entry={item} />
                  <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{formatDate(item.createdAt)}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                {[[ 'Category', item.categoryTag ], [ 'Action Tag', item.actionIdentifier ], [ 'Metric', formatActionMetric(item.actionDetails, item.actionIdentifier) ]].map(([k, v]) => (
                  <div key={k}>
                    <span className="ty-label" style={{ display: 'block', marginBottom: '3px' }}>{k}</span>
                    <strong style={{ fontFamily: 'var(--display)', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{v}</strong>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--line-hairline)', borderLeft: '3px solid var(--line-strong)', padding: '12px 16px', borderRadius: '0 var(--radius-xs) var(--radius-xs) 0', fontStyle: 'italic', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                "{item.impactSummary}"
              </div>

              <div>
                <span className="ty-label" style={{ display: 'inline', marginRight: '6px' }}>Source</span>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--mono, monospace)', fontSize: '12px', color: 'var(--info)', fontWeight: '500', textDecoration: 'none', borderBottom: '1px solid var(--info-border)' }}>{item.sourceUrl}</a>
              </div>

              <LifecycleStageStrip status={item.status} title="Lifecycle Stage" />
            </article>
          )
        })}
      </div>
      {contributions.length > pageSize && <div className="myContribPagination"><PaginationMini page={safePage} totalPages={totalPages} onChange={setPage} /></div>}
    </section>
  )
}
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
