import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ModerationPanel from './components/ModerationPanel'
import UserProfileMatrixPanel from './components/UserProfileMatrixPanel'
import TrustScoreMeter from './components/TrustScoreMeter'
import ConfirmActionModal from './components/ConfirmActionModal'
import PoliticianRankingPanel from './components/PoliticianRankingPanel'
import LifecycleStageStrip from './components/LifecycleStageStrip'
import { ContributionCardsSkeleton, TimelineCardsSkeleton } from './components/Skeletons'
import { clampTrustScore } from './components/trustScore'
import { DeveloperSandboxProvider } from './developer/DeveloperSandboxProvider'
import { useDeveloperSandbox } from './developer/DeveloperSandboxContext'
import DeveloperOptionsPanel from './developer/DeveloperOptionsPanel'
import { useAuth } from './auth/AuthContext'
import AuthPages from './auth/AuthPages'
import TopNav from './components/TopNav'
import UserHistoryPage from './components/UserHistoryPage'
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

const POSITION_GROUPS = {
  Executive: ['President', 'Vice President', 'Cabinet Secretary', 'Undersecretary', 'Assistant Secretary'],
  Legislative: ['Senator', 'Senate President', 'House Representative', 'Party-list Representative', 'Speaker of the House'],
  Judicial: ['Chief Justice', 'Associate Justice', 'Judge'],
  'Local Government': ['Governor', 'Vice Governor', 'Provincial Board Member', 'Mayor', 'Vice Mayor', 'Councilor'],
}
const POSITION_CATEGORIES = Object.keys(POSITION_GROUPS)
const PROVINCE_LEVEL_POSITIONS = new Set(['Governor', 'Vice Governor', 'Provincial Board Member'])
const CITY_LEVEL_POSITIONS = new Set(['Mayor', 'Vice Mayor', 'Councilor'])
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

const emptyPoliticianForm = {
  biography: '',
  cityMunicipalityId: '',
  fullName: '',
  jurisdiction: '',
  jurisdictionType: 'NATIONAL',
  partyAffiliation: '',
  position: '',
  positionCategory: '',
  profileImageUrl: '',
  provinceId: '',
  regionId: '',
  status: 'ACTIVE',
  termEnd: '',
  termStart: '',
}

function politicianMatchesLocation(p, filters) {
  if (filters.jurisdictionType !== 'ALL' && (p.jurisdictionType || '') !== filters.jurisdictionType) return false
  if (filters.positionCategory !== 'ALL' && (p.positionCategory || '') !== filters.positionCategory) return false
  if (filters.position !== 'ALL' && (p.position || '') !== filters.position) return false
  if (filters.regionId !== 'ALL' && (p.regionId || '') !== filters.regionId) return false
  if (filters.provinceId !== 'ALL' && (p.provinceId || '') !== filters.provinceId) return false
  if (filters.cityMunicipalityId !== 'ALL' && (p.cityMunicipalityId || '') !== filters.cityMunicipalityId) return false
  if (filters.partyAffiliation !== 'ALL' && (p.partyAffiliation || '') !== filters.partyAffiliation) return false
  if (filters.status !== 'ALL' && (p.status || '') !== filters.status) return false
  return true
}

function displayJurisdiction(profile) {
  return profile?.jurisdictionDisplay || profile?.jurisdiction || 'Unspecified jurisdiction'
}

function toPoliticianPayload(form) {
  const isNational = form.jurisdictionType === 'NATIONAL'
  const isProvinceLevel = PROVINCE_LEVEL_POSITIONS.has(form.position)
  return {
    biography: form.biography.trim(),
    cityMunicipalityId: isNational || isProvinceLevel ? null : form.cityMunicipalityId || null,
    fullName: form.fullName.trim(),
    jurisdiction: isNational ? 'NATIONAL' : form.jurisdiction.trim(),
    jurisdictionType: form.jurisdictionType,
    partyAffiliation: form.partyAffiliation.trim(),
    position: form.position,
    positionCategory: form.positionCategory,
    profileImageUrl: form.profileImageUrl.trim() || null,
    provinceId: isNational ? null : form.provinceId || null,
    regionId: isNational ? null : form.regionId || null,
    status: form.status || 'ACTIVE',
    termEnd: form.termEnd || null,
    termStart: form.termStart || null,
  }
}

function nextPoliticianForm(current, name, value) {
  const next = { ...current, [name]: value }
  if (name === 'jurisdictionType' && value === 'NATIONAL') {
    next.regionId = ''
    next.provinceId = ''
    next.cityMunicipalityId = ''
    if (next.positionCategory === 'Local Government') {
      next.positionCategory = ''
      next.position = ''
    }
    next.jurisdiction = 'NATIONAL'
  }
  if (name === 'jurisdictionType' && value === 'LOCAL') {
    next.jurisdiction = ''
  }
  if (name === 'positionCategory') {
    next.position = ''
  }
  if (name === 'regionId') {
    next.provinceId = ''
    next.cityMunicipalityId = ''
  }
  if (name === 'provinceId') {
    next.cityMunicipalityId = ''
  }
  if (name === 'position' && PROVINCE_LEVEL_POSITIONS.has(value)) {
    next.cityMunicipalityId = ''
  }
  return next
}

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
  const [locationLookups, setLocationLookups] = useState({
    citiesByProvince: {},
    errors: {},
    loading: {},
    provincesByRegion: {},
    regions: [],
  })

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

  const loadRegions = useCallback(async () => {
    setLocationLookups((current) => ({ ...current, loading: { ...current.loading, regions: true } }))
    try {
      const regions = await fetch(`${API_BASE_URL}/api/regions`).then(readApiResponse)
      setLocationLookups((current) => ({
        ...current,
        errors: { ...current.errors, regions: '' },
        loading: { ...current.loading, regions: false },
        regions,
      }))
    } catch (error) {
      setLocationLookups((current) => ({
        ...current,
        errors: { ...current.errors, regions: error.message },
        loading: { ...current.loading, regions: false },
      }))
    }
  }, [])

  const loadProvinces = useCallback(async (regionId) => {
    if (!regionId) return
    if (locationLookups.provincesByRegion[regionId]) return
    setLocationLookups((current) => ({ ...current, loading: { ...current.loading, [`province:${regionId}`]: true } }))
    try {
      const provinces = await fetch(`${API_BASE_URL}/api/provinces?regionId=${regionId}`).then(readApiResponse)
      setLocationLookups((current) => ({
        ...current,
        provincesByRegion: { ...current.provincesByRegion, [regionId]: provinces },
        loading: { ...current.loading, [`province:${regionId}`]: false },
      }))
    } catch (error) {
      setLocationLookups((current) => ({
        ...current,
        errors: { ...current.errors, [`province:${regionId}`]: error.message },
        loading: { ...current.loading, [`province:${regionId}`]: false },
      }))
    }
  }, [locationLookups.provincesByRegion])

  const loadCities = useCallback(async (provinceId) => {
    if (!provinceId) return
    if (locationLookups.citiesByProvince[provinceId]) return
    setLocationLookups((current) => ({ ...current, loading: { ...current.loading, [`city:${provinceId}`]: true } }))
    try {
      const cities = await fetch(`${API_BASE_URL}/api/cities-municipalities?provinceId=${provinceId}`).then(readApiResponse)
      setLocationLookups((current) => ({
        ...current,
        citiesByProvince: { ...current.citiesByProvince, [provinceId]: cities },
        loading: { ...current.loading, [`city:${provinceId}`]: false },
      }))
    } catch (error) {
      setLocationLookups((current) => ({
        ...current,
        errors: { ...current.errors, [`city:${provinceId}`]: error.message },
        loading: { ...current.loading, [`city:${provinceId}`]: false },
      }))
    }
  }, [locationLookups.citiesByProvince])

  useEffect(() => {
    loadRegions()
  }, [loadRegions])

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
            locationLookups={locationLookups}
            onLoadCities={loadCities}
            onLoadProvinces={loadProvinces}
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
            locationLookups={locationLookups}
            onLoadCities={loadCities}
            onLoadProvinces={loadProvinces}
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
            locationLookups={locationLookups}
            onLoadCities={loadCities}
            onLoadProvinces={loadProvinces}
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
function DashboardPanel({ isLoading = false, onOpenProfile, politicians, onNavigate, user }) {
  const [hoverInfo, setHoverInfo] = useState(null)
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
      description: 'Total number of profile records available for review and comparison. Higher counts indicate broader platform coverage across offices and jurisdictions.',
      hint: 'Open Directory to inspect each profile.',
      accent: 'var(--ph-blue)',
      icon: FolderIcon,
    },
    {
      label: 'COA Flags Tracked',
      value: totalCoaDiscrepancies,
      sub: 'Audit discrepancies logged',
      description: 'Combined count of Commission on Audit discrepancy entries linked to tracked officials. This helps surface governance risk signals quickly.',
      hint: 'Use Compare to cross-check flags side by side.',
      accent: 'var(--ph-gold)',
      icon: BarChart3Icon,
    },
    {
      label: 'Avg. Legislative Eff.',
      value: `${averageEfficiency.toFixed(1)}%`,
      sub: 'Sustained profile average',
      description: 'Average legislative efficiency across all indexed profiles based on published activity data and profile metrics.',
      hint: 'Select a profile to see per-candidate KPI detail.',
      accent: 'var(--info)',
      icon: BarChart3Icon,
    },
    {
      label: 'My Clearance Role',
      value: user?.role || 'CONTRIBUTOR',
      sub: 'Authorized session role',
      description: 'Your current permission level for this signed-in session. Role determines what you can submit, review, or administratively override.',
      hint: 'Role-based access is enforced across all modules.',
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
      description: 'Open the searchable profile list to inspect biography, jurisdiction, party details, and audit-linked records before taking action.',
      hint: 'Best starting point for profile discovery.',
      color: '#e8f0fe',
      iconBg: '#c7d7fc',
    },
    {
      key: 'submit',
      icon: FileTextIcon,
      title: 'File Evidence',
      sub: 'Submit an official audit record',
      description: 'Create a structured contribution using approved source domains and categorized action details so it can enter moderation.',
      hint: 'Prepare source URL + impact summary first.',
      color: '#fef9e8',
      iconBg: '#faedb4',
    },
    {
      key: 'compare',
      icon: ScaleIcon,
      title: 'Compare Profiles',
      sub: 'Side-by-side candidate analysis',
      description: 'Review two candidates in parallel with aligned records and metrics to identify policy, budget, and audit differences faster.',
      hint: 'Use filters to narrow by jurisdiction.',
      color: '#eef6ff',
      iconBg: '#c3ddf9',
    },
    {
      key: 'moderation',
      icon: ShieldCheckIcon,
      title: 'Moderation Jury',
      sub: 'Cast a double-blind ballot',
      description: 'Enter the adjudication queue where reviewers vote on evidence quality and outcome before records are finalized or published.',
      hint: 'Your vote impacts consensus and trust outcomes.',
      color: '#f3f0ff',
      iconBg: '#dbd5fd',
    },
  ]

  return (
    <section className="workspace dashboardWorkspace" style={{ gap: '20px' }}>
      <div style={{ background: 'linear-gradient(148deg, var(--ph-blue) 0%, #0c1e4a 55%, #06102a 100%)', borderRadius: 'var(--radius-xl)', padding: 'clamp(24px, 4vw, 36px)', position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(8, 20, 50, 0.28)' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '5%', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <span className="ty-label" style={{ color: 'rgba(153, 132, 44, 0.95)', marginBottom: '10px', display: 'inline-block' }}>Live: Civic Transparency Platform</span>
          <h2 className="ty-section-title" style={{ color: '#ffffff', margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: '1.15', fontSize: 'clamp(1.25rem, 2.2vw, 1.6rem)' }}>
            Mabuhay, {user?.fullName?.split(' ')[0] || 'Contributor'}.
          </h2>
          <p style={{ color: 'rgba(220, 228, 245, 0.82)', fontSize: '14px', lineHeight: '1.7', margin: 0, maxWidth: '560px' }}>Track, analyze, and verify official legislative and audit records across local and national Philippine jurisdictions.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        {kpis.map(({ label, value, sub, description, hint, accent, icon: Icon }) => (
          <article
            key={label}
            className="hoverLiftCard"
            onMouseEnter={() => setHoverInfo({ title: label, description, hint })}
            onMouseLeave={() => setHoverInfo(null)}
            onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--line-soft)', borderLeft: `3px solid ${accent}`, borderRadius: 'var(--radius-md)', padding: '18px 20px', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', gap: '6px' }}
          >
            <span aria-hidden="true" className="inline-flex items-center justify-center" style={{ width: '22px', height: '22px', color: accent }}><Icon size={18} /></span>
            <span className="ty-label" style={{ marginTop: '4px' }}>{label}</span>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 'clamp(1.3rem, 2vw, 1.8rem)', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.1', letterSpacing: '-0.03em' }}>{value}</strong>
            <small className="ty-meta">{sub}</small>
          </article>
        ))}
      </div>

      <section>
        <h2 className="ty-section-title" style={{ margin: '0 0 14px' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          {actions.map(({ key, icon: Icon, title, sub, description, hint, color, iconBg }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              onMouseEnter={() => setHoverInfo({ title, description, hint })}
              onMouseLeave={() => setHoverInfo(null)}
              onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
              type="button"
              className="dashboardCard"
              style={{ minHeight: '120px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', gridTemplateColumns: 'none', background: 'var(--bg-surface)' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: color, border: `1px solid ${iconBg}`, color: 'var(--ph-blue)' }}><Icon size={18} /></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <strong className="ty-card-title">{title}</strong>
                <small className="ty-meta">{sub}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="ty-section-title" style={{ margin: '0 0 14px' }}>Performance Ranking</h2>
        <PoliticianRankingPanel isLoading={isLoading} onSelectPolitician={onOpenProfile} politicians={politicians} />
      </section>
      <CursorHint hoverInfo={hoverInfo} />
    </section>
  )
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
function PoliticianFormFields({ errors, form, locationLookups, onChange }) {
  const provinces = form.regionId ? (locationLookups.provincesByRegion[form.regionId] || []) : []
  const cities = form.provinceId ? (locationLookups.citiesByProvince[form.provinceId] || []) : []
  const positions = form.positionCategory ? (POSITION_GROUPS[form.positionCategory] || []) : []
  const showLocalFields = form.jurisdictionType === 'LOCAL'
  const showCity = showLocalFields && !PROVINCE_LEVEL_POSITIONS.has(form.position)

  return (
    <>
      <label>Full Name<input name="fullName" onChange={onChange} required value={form.fullName} />{errors.fullName && <span className="fieldError">{errors.fullName}</span>}</label>
      <label>
        Jurisdiction Type
        <select name="jurisdictionType" onChange={onChange} required value={form.jurisdictionType}>
          <option value="NATIONAL">National</option>
          <option value="LOCAL">Local</option>
        </select>
        {errors.jurisdictionType && <span className="fieldError">{errors.jurisdictionType}</span>}
      </label>
      <label>
        Position Category
        <select name="positionCategory" onChange={onChange} required value={form.positionCategory}>
          <option value="">Select category</option>
          {POSITION_CATEGORIES
            .filter((category) => form.jurisdictionType === 'LOCAL' || category !== 'Local Government')
            .map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        {errors.positionCategory && <span className="fieldError">{errors.positionCategory}</span>}
      </label>
      <label>
        Position
        <select name="position" onChange={onChange} required value={form.position}>
          <option value="">Select position</option>
          {positions.map((position) => <option key={position} value={position}>{position}</option>)}
        </select>
        {errors.position && <span className="fieldError">{errors.position}</span>}
      </label>
      {showLocalFields && (
        <>
          <label>
            Region
            <select name="regionId" onChange={onChange} required value={form.regionId}>
              <option value="">Select region</option>
              {locationLookups.loading.regions && <option value="">Loading...</option>}
              {locationLookups.regions.map((region) => <option key={region.regionId} value={region.regionId}>{region.regionName}</option>)}
            </select>
            {errors.regionId && <span className="fieldError">{errors.regionId}</span>}
          </label>
          <label>
            Province
            <select disabled={!form.regionId} name="provinceId" onChange={onChange} required value={form.provinceId}>
              <option value="">{form.regionId ? 'Select province' : 'Select region first'}</option>
              {locationLookups.loading[`province:${form.regionId}`] && <option value="">Loading...</option>}
              {form.regionId && provinces.length === 0 && !locationLookups.loading[`province:${form.regionId}`] && <option value="">No provinces available</option>}
              {provinces.map((province) => <option key={province.provinceId} value={province.provinceId}>{province.provinceName}</option>)}
            </select>
            {errors.provinceId && <span className="fieldError">{errors.provinceId}</span>}
          </label>
          {showCity && (
            <label>
              City/Municipality
              <select disabled={!form.provinceId} name="cityMunicipalityId" onChange={onChange} required={CITY_LEVEL_POSITIONS.has(form.position)} value={form.cityMunicipalityId}>
                <option value="">{form.provinceId ? 'Select city/municipality' : 'Select province first'}</option>
                {locationLookups.loading[`city:${form.provinceId}`] && <option value="">Loading...</option>}
                {form.provinceId && cities.length === 0 && !locationLookups.loading[`city:${form.provinceId}`] && <option value="">No cities or municipalities available</option>}
                {cities.map((city) => <option key={city.cityMunicipalityId} value={city.cityMunicipalityId}>{city.name}</option>)}
              </select>
              {errors.cityMunicipalityId && <span className="fieldError">{errors.cityMunicipalityId}</span>}
            </label>
          )}
        </>
      )}
      <label>Party / Affiliation<input name="partyAffiliation" onChange={onChange} value={form.partyAffiliation} />{errors.partyAffiliation && <span className="fieldError">{errors.partyAffiliation}</span>}</label>
      <label>Profile Image URL<input name="profileImageUrl" onChange={onChange} type="url" value={form.profileImageUrl} />{errors.profileImageUrl && <span className="fieldError">{errors.profileImageUrl}</span>}</label>
      <label>Biography<textarea name="biography" onChange={onChange} rows="5" value={form.biography} />{errors.biography && <span className="fieldError">{errors.biography}</span>}</label>
    </>
  )
}

function PoliticianDirectoryLoaderPanel({
  dashboardId, dbUser, onChange, onViewProfile, onSubmit,
  locationLookups, onLoadCities, onLoadProvinces,
  politicians, politiciansState, state, onModalOpenChange, onPoliticianUpdate, onPoliticianCreate, token,
}) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    cityMunicipalityId: 'ALL',
    jurisdictionType: 'ALL',
    partyAffiliation: 'ALL',
    position: 'ALL',
    positionCategory: 'ALL',
    provinceId: 'ALL',
    regionId: 'ALL',
    status: 'ALL',
  })
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
    ...emptyPoliticianForm,
  })
  const [createForm, setCreateForm] = useState({
    ...emptyPoliticianForm,
  })
  const isDatabaseAdmin = dbUser?.role === 'ADMIN'
  const partyOptions = useMemo(() => (
    Array.from(new Set(politicians.map((p) => p.partyAffiliation).filter(Boolean))).sort()
  ), [politicians])
  const provincesForFilter = filters.regionId === 'ALL' ? [] : (locationLookups.provincesByRegion[filters.regionId] || [])
  const citiesForFilter = filters.provinceId === 'ALL' ? [] : (locationLookups.citiesByProvince[filters.provinceId] || [])

  const filteredPoliticians = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((p) => {
      const matchesQuery = !q || p.fullName.toLowerCase().includes(q) || (p.position || '').toLowerCase().includes(q)
      return matchesQuery && politicianMatchesLocation(p, filters)
    })
  }, [filters, politicians, query])

  useEffect(() => {
    setPage(1)
  }, [query, filters])

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
      ...emptyPoliticianForm,
    })
    setIsCreateOpen(true)
  }

  function openEditModal() {
    if (!detailsData || !isDatabaseAdmin) return
    setEditErrors({})
    setEditForm({
      ...emptyPoliticianForm,
      biography: detailsData.biography || '',
      fullName: detailsData.fullName || '',
      jurisdiction: detailsData.jurisdiction || '',
      jurisdictionType: detailsData.jurisdictionType || 'NATIONAL',
      partyAffiliation: detailsData.partyAffiliation || '',
      position: detailsData.position || '',
      positionCategory: detailsData.positionCategory || '',
      profileImageUrl: detailsData.profileImageUrl || '',
      regionId: detailsData.regionId || '',
      provinceId: detailsData.provinceId || '',
      cityMunicipalityId: detailsData.cityMunicipalityId || '',
      status: detailsData.status || 'ACTIVE',
      termStart: detailsData.termStart || '',
      termEnd: detailsData.termEnd || '',
    })
    if (detailsData.regionId) onLoadProvinces(detailsData.regionId)
    if (detailsData.provinceId) onLoadCities(detailsData.provinceId)
    setIsEditOpen(true)
  }

  function updateEditField(e) {
    const { name, value } = e.target
    setEditForm((current) => nextPoliticianForm(current, name, value))
    if (name === 'regionId') onLoadProvinces(value)
    if (name === 'provinceId') onLoadCities(value)
  }

  function updateCreateField(e) {
    const { name, value } = e.target
    setCreateForm((current) => nextPoliticianForm(current, name, value))
    if (name === 'regionId') onLoadProvinces(value)
    if (name === 'provinceId') onLoadCities(value)
  }

  function updateFilterField(e) {
    const { name, value } = e.target
    setFilters((current) => {
      const next = { ...current, [name]: value }
      if (name === 'jurisdictionType' && value === 'NATIONAL') {
        next.regionId = 'ALL'
        next.provinceId = 'ALL'
        next.cityMunicipalityId = 'ALL'
      }
      if (name === 'positionCategory') next.position = 'ALL'
      if (name === 'regionId') {
        next.provinceId = 'ALL'
        next.cityMunicipalityId = 'ALL'
      }
      if (name === 'provinceId') next.cityMunicipalityId = 'ALL'
      return next
    })
    if (name === 'regionId' && value !== 'ALL') onLoadProvinces(value)
    if (name === 'provinceId' && value !== 'ALL') onLoadCities(value)
  }

  function validateEditForm() {
    const errors = {}
    if (!editForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!editForm.position.trim()) errors.position = 'Position is required.'
    if (!editForm.jurisdictionType) errors.jurisdictionType = 'Jurisdiction type is required.'
    if (!editForm.positionCategory) errors.positionCategory = 'Position category is required.'
    if (editForm.jurisdictionType === 'LOCAL') {
      if (!editForm.regionId) errors.regionId = 'Region is required.'
      if (!editForm.provinceId) errors.provinceId = 'Province is required.'
      if (CITY_LEVEL_POSITIONS.has(editForm.position) && !editForm.cityMunicipalityId) {
        errors.cityMunicipalityId = 'City/Municipality is required.'
      }
    }
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateCreateForm() {
    const errors = {}
    if (!createForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!createForm.jurisdictionType) errors.jurisdictionType = 'Jurisdiction type is required.'
    if (!createForm.positionCategory) errors.positionCategory = 'Position category is required.'
    if (!createForm.position.trim()) errors.position = 'Position is required.'
    if (!createForm.status.trim()) errors.status = 'Status is required.'
    if (createForm.jurisdictionType === 'LOCAL') {
      if (!createForm.regionId) errors.regionId = 'Region is required.'
      if (!createForm.provinceId) errors.provinceId = 'Province is required.'
      if (CITY_LEVEL_POSITIONS.has(createForm.position) && !createForm.cityMunicipalityId) {
        errors.cityMunicipalityId = 'City/Municipality is required.'
      }
    }
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
      ...toPoliticianPayload(editForm),
      politicianId: detailsData.politicianId,
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

    const payload = toPoliticianPayload(createForm)

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
          Jurisdiction Type
          <select name="jurisdictionType" onChange={updateFilterField} value={filters.jurisdictionType}>
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="LOCAL">Local</option>
          </select>
        </label>
        <label>
          Position Category
          <select name="positionCategory" onChange={updateFilterField} value={filters.positionCategory}>
            <option value="ALL">All</option>
            {POSITION_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Position
          <select name="position" onChange={updateFilterField} value={filters.position}>
            <option value="ALL">All</option>
            {(filters.positionCategory === 'ALL'
              ? Object.values(POSITION_GROUPS).flat()
              : POSITION_GROUPS[filters.positionCategory] || []
            ).map((position) => <option key={position} value={position}>{position}</option>)}
          </select>
        </label>
        {filters.jurisdictionType !== 'NATIONAL' && (
          <>
            <label>
              Region
              <select name="regionId" onChange={updateFilterField} value={filters.regionId}>
                <option value="ALL">All</option>
                {locationLookups.loading.regions && <option value="ALL">Loading...</option>}
                {locationLookups.regions.map((region) => (
                  <option key={region.regionId} value={region.regionId}>{region.regionName}</option>
                ))}
              </select>
            </label>
            <label>
              Province
              <select disabled={filters.regionId === 'ALL'} name="provinceId" onChange={updateFilterField} value={filters.provinceId}>
                <option value="ALL">{filters.regionId === 'ALL' ? 'Select region first' : 'All'}</option>
                {locationLookups.loading[`province:${filters.regionId}`] && <option value="ALL">Loading...</option>}
                {provincesForFilter.map((province) => (
                  <option key={province.provinceId} value={province.provinceId}>{province.provinceName}</option>
                ))}
              </select>
            </label>
            <label>
              City/Municipality
              <select disabled={filters.provinceId === 'ALL'} name="cityMunicipalityId" onChange={updateFilterField} value={filters.cityMunicipalityId}>
                <option value="ALL">{filters.provinceId === 'ALL' ? 'Select province first' : 'All'}</option>
                {locationLookups.loading[`city:${filters.provinceId}`] && <option value="ALL">Loading...</option>}
                {citiesForFilter.map((city) => (
                  <option key={city.cityMunicipalityId} value={city.cityMunicipalityId}>{city.name}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Party
          <select name="partyAffiliation" onChange={updateFilterField} value={filters.partyAffiliation}>
            <option value="ALL">All</option>
            {partyOptions.map((party) => <option key={party} value={party}>{party}</option>)}
          </select>
        </label>
        <label>
          Status
          <select name="status" onChange={updateFilterField} value={filters.status}>
            <option value="ALL">All</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
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
              <small className="ty-meta">{displayJurisdiction(politician)}</small>
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
                  <p className="ty-body">{displayJurisdiction(detailsData)}</p>
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
                <PoliticianFormFields errors={editErrors} form={editForm} locationLookups={locationLookups} onChange={updateEditField} />
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
                <PoliticianFormFields errors={createErrors} form={createForm} locationLookups={locationLookups} onChange={updateCreateField} />
                <label>
                  Status
                  <select name="status" onChange={updateCreateField} required value={createForm.status}>
                    <option value="">Select status</option>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
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
function PoliticianProfilePage({ dbUser, locationLookups, onAddContribution, onLoadCities, onLoadProvinces, onPoliticianUpdate, onReload, onUserUpdate, onAppealModalOpenChange, politicianId, politicians, state, token, user }) {
  const fallbackProfile = politicians.find((p) => p.politicianId === politicianId) || null
  const profile = state.data || fallbackProfile
  const timelineEntries = state.data?.publishedTimelineLedger || state.data?.timeline || state.data?.entries || []
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [appealTarget, setAppealTarget] = useState(null)
  const [appealState, setAppealState] = useState({ status: 'idle', message: '' })
  const [editErrors, setEditErrors] = useState({})
  const [editForm, setEditForm] = useState({ ...emptyPoliticianForm })
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
      ...emptyPoliticianForm,
      biography: profile.biography || '', fullName: profile.fullName || '',
      jurisdiction: profile.jurisdiction || '', partyAffiliation: profile.partyAffiliation || '',
      jurisdictionType: profile.jurisdictionType || 'NATIONAL',
      position: profile.position || '', positionCategory: profile.positionCategory || '', profileImageUrl: profile.profileImageUrl || '',
      regionId: profile.regionId || '', provinceId: profile.provinceId || '', cityMunicipalityId: profile.cityMunicipalityId || '',
      status: profile.status || 'ACTIVE', termStart: profile.termStart || '', termEnd: profile.termEnd || '',
    })
    if (profile.regionId) onLoadProvinces(profile.regionId)
    if (profile.provinceId) onLoadCities(profile.provinceId)
    setIsEditOpen(true)
  }

  function updateEditField(e) {
    const { name, value } = e.target
    setEditForm((current) => nextPoliticianForm(current, name, value))
    if (name === 'regionId') onLoadProvinces(value)
    if (name === 'provinceId') onLoadCities(value)
  }

  function validateEditForm() {
    const errors = {}
    if (!editForm.fullName.trim()) errors.fullName = 'Full name is required.'
    if (!editForm.position.trim()) errors.position = 'Position is required.'
    if (!editForm.jurisdictionType) errors.jurisdictionType = 'Jurisdiction type is required.'
    if (!editForm.positionCategory) errors.positionCategory = 'Position category is required.'
    if (editForm.jurisdictionType === 'LOCAL') {
      if (!editForm.regionId) errors.regionId = 'Region is required.'
      if (!editForm.provinceId) errors.provinceId = 'Province is required.'
      if (CITY_LEVEL_POSITIONS.has(editForm.position) && !editForm.cityMunicipalityId) errors.cityMunicipalityId = 'City/Municipality is required.'
    }
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!profile || !isDatabaseAdmin || !validateEditForm()) return
    const updates = {
      ...toPoliticianPayload(editForm),
      politicianId: profile.politicianId,
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
            <p className="ty-body">{displayJurisdiction(profile)}</p>
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
                <PoliticianFormFields errors={editErrors} form={editForm} locationLookups={locationLookups} onChange={updateEditField} />
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
function ComparisonPanel({ compareIds, locationLookups, onChange, onLoadCities, onLoadProvinces, onModalOpenChange, onSubmit, politicians, politiciansState, state }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    cityMunicipalityId: 'ALL',
    jurisdictionType: 'ALL',
    partyAffiliation: 'ALL',
    position: 'ALL',
    positionCategory: 'ALL',
    provinceId: 'ALL',
    regionId: 'ALL',
    status: 'ALL',
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pageLeft, setPageLeft] = useState(1)
  const [pageRight, setPageRight] = useState(1)
  const pageSize = 5

  const filteredPoliticians = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((p) => {
      const matchesQ = !q || p.fullName.toLowerCase().includes(q) || (p.position || '').toLowerCase().includes(q)
      return matchesQ && politicianMatchesLocation(p, filters)
    })
  }, [filters, politicians, query])

  useEffect(() => {
    setPageLeft(1)
    setPageRight(1)
  }, [query, filters])

  function updateFilterField(e) {
    const { name, value } = e.target
    setFilters((current) => {
      const next = { ...current, [name]: value }
      if (name === 'jurisdictionType' && value === 'NATIONAL') {
        next.regionId = 'ALL'; next.provinceId = 'ALL'; next.cityMunicipalityId = 'ALL'
      }
      if (name === 'positionCategory') next.position = 'ALL'
      if (name === 'regionId') {
        next.provinceId = 'ALL'; next.cityMunicipalityId = 'ALL'
      }
      if (name === 'provinceId') next.cityMunicipalityId = 'ALL'
      return next
    })
    if (name === 'regionId' && value !== 'ALL') onLoadProvinces(value)
    if (name === 'provinceId' && value !== 'ALL') onLoadCities(value)
  }

  const provincesForFilter = filters.regionId === 'ALL' ? [] : (locationLookups.provincesByRegion[filters.regionId] || [])
  const citiesForFilter = filters.provinceId === 'ALL' ? [] : (locationLookups.citiesByProvince[filters.provinceId] || [])

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
          Jurisdiction Type
          <select name="jurisdictionType" onChange={updateFilterField} value={filters.jurisdictionType}>
            <option value="ALL">All</option>
            <option value="NATIONAL">National</option>
            <option value="LOCAL">Local</option>
          </select>
        </label>
        <label>
          Position Category
          <select name="positionCategory" onChange={updateFilterField} value={filters.positionCategory}>
            <option value="ALL">All</option>
            {POSITION_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Position
          <select name="position" onChange={updateFilterField} value={filters.position}>
            <option value="ALL">All</option>
            {(filters.positionCategory === 'ALL' ? Object.values(POSITION_GROUPS).flat() : POSITION_GROUPS[filters.positionCategory] || [])
              .map((position) => <option key={position} value={position}>{position}</option>)}
          </select>
        </label>
        {filters.jurisdictionType !== 'NATIONAL' && (
          <>
            <label>
              Region
              <select name="regionId" onChange={updateFilterField} value={filters.regionId}>
                <option value="ALL">All</option>
                {locationLookups.regions.map((region) => <option key={region.regionId} value={region.regionId}>{region.regionName}</option>)}
              </select>
            </label>
            <label>
              Province
              <select disabled={filters.regionId === 'ALL'} name="provinceId" onChange={updateFilterField} value={filters.provinceId}>
                <option value="ALL">{filters.regionId === 'ALL' ? 'Select region first' : 'All'}</option>
                {provincesForFilter.map((province) => <option key={province.provinceId} value={province.provinceId}>{province.provinceName}</option>)}
              </select>
            </label>
            <label>
              City/Municipality
              <select disabled={filters.provinceId === 'ALL'} name="cityMunicipalityId" onChange={updateFilterField} value={filters.cityMunicipalityId}>
                <option value="ALL">{filters.provinceId === 'ALL' ? 'Select province first' : 'All'}</option>
                {citiesForFilter.map((city) => <option key={city.cityMunicipalityId} value={city.cityMunicipalityId}>{city.name}</option>)}
              </select>
            </label>
          </>
        )}
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

function TimelineLedger({ className = '', entries, compact = false, isLoading = false, onAppeal, title = 'Published Timeline Ledger', user }) {
  const trustScore = clampTrustScore(user?.trustScore)
  const canAppeal = Boolean(user?.userId) && user?.role !== 'GUEST' && trustScore >= 150
  const [page, setPage] = useState(1)
  const [hoverInfo, setHoverInfo] = useState(null)
  const pageSize = 15
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedEntries = entries.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => { setPage(1) }, [entries.length])

  return (
    <section className={[compact ? 'timeline compact' : 'timeline', className].filter(Boolean).join(' ')}>
      <div className="timelineHeader">
        <h2 className="ty-section-title">{title}</h2>
        {!isLoading && entries.length > pageSize && <PaginationMini page={safePage} totalPages={totalPages} onChange={setPage} />}
      </div>
      {isLoading && <TimelineCardsSkeleton count={6} />}
      {!isLoading && entries.length === 0 && <p className="emptyState">No published records returned.</p>}
      {!isLoading && <div className="timelineGrid">
        {pagedEntries.map((entry) => (
          <article className="timelineItem" key={entry.timelineId || `${entry.categoryTag}-${entry.createdAt}`}>
            <div className="timelineItemTop">
              <strong>{entry.actionIdentifier}</strong>
              <span style={{ background: 'var(--bg-inset)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-full)', fontFamily: 'var(--mono, monospace)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.04em', padding: '2px 8px', color: 'var(--text-muted)' }}>{entry.categoryTag}</span>
            </div>
            <p className="ty-body">{entry.summary}</p>
            <a
              href={entry.sourceUrl}
              rel="noreferrer"
              target="_blank"
              onMouseEnter={() => setHoverInfo({
                title: 'Source Evidence Link',
                description: 'Opens the cited source document in a separate tab so you can validate authenticity, context, and completeness.',
                hint: 'Tip: verify domain and publication date before citing.',
              })}
              onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
              onMouseLeave={() => setHoverInfo(null)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>View Source <ExternalLinkIcon size={14} /></span>
            </a>
            {onAppeal && (
              <div className="appealActionArea">
                <button
                  className="appealRecordButton"
                  disabled={!canAppeal || !entry.submissionId}
                  onClick={() => onAppeal(entry)}
                  title={!entry.submissionId ? 'This legacy record is missing submission linkage.' : !canAppeal ? 'Appeals require an authenticated user with at least 150.00 trust points.' : 'File a high-stakes post-publish appeal.'}
                  type="button"
                >
                  <ScaleIcon size={15} />
                  Appeal this Record
                </button>
                <div className="appealInfoTooltip" role="tooltip">
                  {entry.submissionId ? <TrustScoreMeter score={trustScore} variant="inline" /> : <p className="ty-meta" style={{ color: 'var(--danger)', margin: 0 }}>Record cannot be appealed: missing submission linkage.</p>}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>}
      <CursorHint hoverInfo={hoverInfo} />
    </section>
  )
}

function TrustDeltaBadge({ entry }) {
  const status = String(entry.publicationStatus || entry.status || '').toUpperCase()
  const delta = status === 'PUBLISHED' ? 15 : status === 'REJECTED' ? -15 : 0
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
