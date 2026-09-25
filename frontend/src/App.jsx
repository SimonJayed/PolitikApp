import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useAuth } from './auth/AuthContext'
import TopNav from './components/TopNav'
import AuthPromptModal from './components/AuthPromptModal'
import WgiMethodologyModal from './components/governance/WgiMethodologyModal'
import AppPageHeader from './components/layout/AppPageHeader'
import NoticeBanner from './components/layout/NoticeBanner'

import './components/governance.css'
import './components/moderation.css'
import { API_BASE_URL, readApiResponse } from './api/client'
import { activeHeaders, guestRestrictedViews, headerTitleHiddenFor } from './config/appRoutes'
import { emptySubmission, normalizeActionDetails } from './features/submissions/submissionForm'
import AppRoutes from './routes/AppRoutes'

function AppInner({ currentUser, isAuthenticated = false, onLogout, onUserUpdate, token }) {
  const [resolvedUser, setResolvedUser] = useState(currentUser || null)
  const wasAuthenticated = useRef(isAuthenticated)
  const activeUser = isAuthenticated ? resolvedUser : null
  const currentRole = activeUser?.role || 'CONTRIBUTOR'

  const initialParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialViewParam = initialParams.get('view')
  const initialPoliticianParam = initialParams.get('id') || initialParams.get('politicianId')

  const [activeView, setActiveView] = useState(() => {
    if (initialViewParam) return initialViewParam
    return isAuthenticated ? 'dashboard' : 'landing'
  })
  const [politiciansState, setPoliticiansState] = useState({
    data: [],
    message: '',
    selected: null,
    status: 'idle',
  })
  const [formData, setFormData] = useState(emptySubmission)
  const [submissionState, setSubmissionState] = useState({ status: 'idle', message: '' })
  const [, setDashboardId] = useState('')
  const [dashboardState, setDashboardState] = useState({ status: 'idle', message: '', data: null })
  const dashboardRequestSeq = useRef(0)
  const [selectedPoliticianId, setSelectedPoliticianId] = useState(() => initialPoliticianParam || '')
  const [compareIds, setCompareIds] = useState({ idA: '', idB: '' })
  const [comparisonState, setComparisonState] = useState({ status: 'idle', message: '', data: null })
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false)
  const [isPoliticiansModalOpen, setIsPoliticiansModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [, setIsApprovedDomain] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authModalConfig, setAuthModalConfig] = useState({ isOpen: false, actionType: 'general' })
  const [isWgiMethodologyOpen, setIsWgiMethodologyOpen] = useState(false)
  const [notFoundNotice, setNotFoundNotice] = useState('')

  useEffect(() => {
    setResolvedUser(currentUser || null)

    if (!isAuthenticated && wasAuthenticated.current) {
      setActiveView('landing')
      setAuthModalConfig({ isOpen: false, actionType: 'general' })
      setIsCompareModalOpen(false)
      setIsAppealModalOpen(false)
      setIsPoliticiansModalOpen(false)
      setIsProfileModalOpen(false)
    }

    wasAuthenticated.current = isAuthenticated
  }, [currentUser, isAuthenticated])

  const triggerAuthPrompt = useCallback((actionType = 'general') => {
    setAuthModalConfig({ isOpen: true, actionType })
  }, [])

  const activeHeader = activeHeaders[activeView] || activeHeaders.dashboard
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

  // Re-fetch politician list whenever the dashboard view becomes active so that
  // KPIs (billsAuthored, projectCompletions, WGI score, etc.) reflect any
  // submissions that were approved/published since the initial page load.
  useEffect(() => {
    if (activeView === 'dashboard') {
      loadPoliticians()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

  useEffect(() => {
    let cancelled = false
    if (!token) return () => { cancelled = true }
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          onLogout?.()
          throw new Error('Session expired or unauthorized')
        }
        return readApiResponse(res)
      })
      .then((data) => {
        if (cancelled || !data) return
        setResolvedUser(data)
        onUserUpdate?.(data)
      })
      .catch(() => null)
    return () => { cancelled = true }
  }, [token, onUserUpdate, onLogout])

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
      const data = await fetch(`${API_BASE_URL}/api/submissions/my`, {
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        method: 'POST',
      }).then(readApiResponse)
      setFormData(emptySubmission)
      setIsApprovedDomain(false)
      setSubmissionState({ status: 'success', message: data.message || 'Submission queued.' })
      // Refresh politician KPIs in the background so ranking data stays current
      loadPoliticians()
    } catch (error) {
      setSubmissionState({ status: 'error', message: error.message })
    }
  }

  async function loadDashboardById(politicianId) {
    if (!politicianId) {
      setDashboardState({ status: 'error', message: 'Select a politician first.', data: null })
      return { ok: false }
    }
    const requestSeq = dashboardRequestSeq.current + 1
    dashboardRequestSeq.current = requestSeq
    setDashboardState({ status: 'loading', message: 'Loading dashboard...', data: null })
    try {
      const data = await fetch(`${API_BASE_URL}/api/politicians/${politicianId}/dashboard`).then(readApiResponse)
      if (requestSeq !== dashboardRequestSeq.current) return { ok: false, stale: true }
      setDashboardState({ status: 'success', message: '', data })
      return { ok: true, data }
    } catch (error) {
      if (requestSeq !== dashboardRequestSeq.current) return { ok: false, stale: true }
      setDashboardState({ status: 'error', message: error.message, data: null })
      return { ok: false, error }
    }
  }

  const navigateTo = useCallback((viewKey, politicianId = null, replace = false) => {
    setNotFoundNotice('')
    setActiveView(viewKey)
    if (politicianId !== null) {
      setSelectedPoliticianId(politicianId)
    }

    try {
      const url = new URL(window.location.href)
      if (viewKey && viewKey !== 'landing') {
        url.searchParams.set('view', viewKey)
      } else {
        url.searchParams.delete('view')
      }

      if (politicianId) {
        url.searchParams.set('id', politicianId)
        url.searchParams.delete('politicianId')
      } else if (politicianId === '') {
        url.searchParams.delete('id')
        url.searchParams.delete('politicianId')
      }

      if (replace) {
        window.history.replaceState({ view: viewKey, id: politicianId }, '', url.toString())
      } else {
        window.history.pushState({ view: viewKey, id: politicianId }, '', url.toString())
      }
    } catch {
      // Ignore URL manipulation failures
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const selectView = useCallback((viewKey) => {
    if (!isAuthenticated && guestRestrictedViews.has(viewKey)) {
      triggerAuthPrompt('preview')
      return
    }
    navigateTo(viewKey)
  }, [isAuthenticated, navigateTo, triggerAuthPrompt])

  useEffect(() => {
    if (!isAuthenticated && initialViewParam && guestRestrictedViews.has(initialViewParam)) {
      navigateTo('landing', null, true)
      return
    }
    function handlePopState() {
      const params = new URLSearchParams(window.location.search)
      const requestedView = params.get('view')
      const v = !isAuthenticated && guestRestrictedViews.has(requestedView)
        ? 'landing'
        : requestedView || (isAuthenticated ? 'dashboard' : 'landing')
      const id = params.get('id') || params.get('politicianId') || ''
      setActiveView(v)
      if (id) {
        setSelectedPoliticianId(id)
        setDashboardId(id)
        loadDashboardById(id)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [initialViewParam, isAuthenticated, navigateTo])

  const coldLoadHandled = useRef(false)
  useEffect(() => {
    if (coldLoadHandled.current || politiciansState.status !== 'success') return
    coldLoadHandled.current = true

    if (initialViewParam === 'profile' && initialPoliticianParam) {
      const found = politiciansState.data.some((p) => p.politicianId === initialPoliticianParam)
      if (found) {
        setSelectedPoliticianId(initialPoliticianParam)
        setDashboardId(initialPoliticianParam)
        loadDashboardById(initialPoliticianParam)
      } else {
        setNotFoundNotice(`Politician profile "${initialPoliticianParam}" was not found. Redirected to Politicians.`)
        navigateTo('politicians', '', true)
      }
    }
  }, [politiciansState.status, politiciansState.data, initialViewParam, initialPoliticianParam, navigateTo])

  useEffect(() => {
    if (isAuthenticated && (activeView === 'auth' || activeView === 'landing')) {
      navigateTo('dashboard', null, true)
    }
  }, [isAuthenticated, activeView, navigateTo])

  async function openPoliticianProfile(politicianId) {
    if (!politicianId) return
    setSelectedPoliticianId(politicianId)
    setDashboardId(politicianId)
    navigateTo('profile', politicianId)
    return loadDashboardById(politicianId)
  }

  function openSubmitContributionForPolitician(politicianId) {
    if (!isAuthenticated) {
      triggerAuthPrompt('propose')
      return
    }
    if (!politicianId) return
    setSelectedPoliticianId(politicianId)
    // Reset the whole form to a clean state for this politician so stale
    // action details, previous status messages, and invalid actionIdentifier
    // values from a prior session do not bleed through.
    setFormData({
      ...emptySubmission,
      politicianId,
    })
    setSubmissionState({ status: 'idle', message: '' })
    setIsApprovedDomain(false)
    navigateTo('submit', politicianId)
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

  const isAnyModalOpen = isCompareModalOpen || isAppealModalOpen || isPoliticiansModalOpen || isProfileModalOpen
  const isAuthView = activeView === 'auth'

  return (
    <main className="appShell">
      {!isAuthView && (
        <TopNav
          activeView={activeView}
          isCompareModalOpen={isCompareModalOpen}
          isModalOpen={isAnyModalOpen || authModalConfig.isOpen || isWgiMethodologyOpen}
          onAuthClick={(mode) => {
            setAuthMode(mode || 'login')
            navigateTo('auth')
          }}
          onLogout={onLogout}
          onSelectView={selectView}
          title="PolitikApp"
          user={activeUser}
        />
      )}

      <section
        className={isAuthView
          ? 'authPageContent'
          : `${isAnyModalOpen ? 'pageContent pt-0' : 'pageContent pt-28'} ${activeView === 'landing' ? '' : 'pageContentAligned'}`}
      >
        {!isAuthView && !isAnyModalOpen && showHeaderTitles && <AppPageHeader activeHeader={activeHeader} />}
        <NoticeBanner message={notFoundNotice} onDismiss={() => setNotFoundNotice('')} />
        <AppRoutes
          activeUser={activeUser}
          activeView={activeView}
          authMode={authMode}
          compareIds={compareIds}
          comparisonState={comparisonState}
          currentRole={currentRole}
          currentUser={currentUser}
          dashboardState={dashboardState}
          formData={formData}
          handleComparisonLookup={handleComparisonLookup}
          handlePoliticianLocalCreate={handlePoliticianLocalCreate}
          handlePoliticianLocalUpdate={handlePoliticianLocalUpdate}
          handleSubmission={handleSubmission}
          isAuthenticated={isAuthenticated}
          navigateTo={navigateTo}
          onUserUpdate={onUserUpdate}
          openPoliticianProfile={openPoliticianProfile}
          openSubmitContributionForPolitician={openSubmitContributionForPolitician}
          politiciansState={politiciansState}
          selectedPoliticianId={selectedPoliticianId}
          selectView={selectView}
          setAuthMode={setAuthMode}
          setCompareIds={setCompareIds}
          setFormDataField={updateFormField}
          setIsApprovedDomain={setIsApprovedDomain}
          setIsAppealModalOpen={setIsAppealModalOpen}
          setIsCompareModalOpen={setIsCompareModalOpen}
          setIsPoliticiansModalOpen={setIsPoliticiansModalOpen}
          setIsProfileModalOpen={setIsProfileModalOpen}
          setWgiMethodologyOpen={setIsWgiMethodologyOpen}
          submissionState={submissionState}
          token={token}
          triggerAuthPrompt={triggerAuthPrompt}
          updateActionDetail={updateActionDetail}
        />
      </section>

      <AuthPromptModal
        isOpen={authModalConfig.isOpen}
        actionType={authModalConfig.actionType}
        onClose={() => setAuthModalConfig({ isOpen: false, actionType: 'general' })}
        onSignIn={() => {
          setAuthModalConfig({ isOpen: false, actionType: 'general' })
          setAuthMode('login')
          navigateTo('auth')
        }}
        onRegister={() => {
          setAuthModalConfig({ isOpen: false, actionType: 'general' })
          setAuthMode('register')
          navigateTo('auth')
        }}
      />

      <WgiMethodologyModal
        isOpen={isWgiMethodologyOpen}
        onClose={() => setIsWgiMethodologyOpen(false)}
      />
    </main>
  )
}

function App() {
  const { isAuthenticated, logout, token, updateSession, user } = useAuth()
  return <AppInner
    currentUser={user}
    isAuthenticated={isAuthenticated}
    onLogout={logout}
    onUserUpdate={updateSession}
    token={token}
  />
}


export default App
