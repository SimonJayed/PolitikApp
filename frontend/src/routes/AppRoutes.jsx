import ModerationPanel from '../components/ModerationPanel'
import RestrictedModerationAccess from '../components/moderation/RestrictedModerationAccess'
import Account from '../pages/Account/Account'
import Authentication from '../pages/Authentication/Authentication'
import ComparisonPanel from '../pages/Compare/Compare'
import MyContributionsPanel from '../pages/Contributions/Contributions'
import Dashboard from '../pages/Dashboard/Dashboard'
import History from '../pages/History/History'
import Landing from '../pages/Landing/Landing'
import PoliticiansLoaderPanel from '../pages/Politicians/Politicians'
import PoliticianProfilePage from '../pages/Profile/Profile'
import ProfileMatrix from '../pages/ProfileMatrix/ProfileMatrix'
import SubmitContribution from '../pages/SubmitContribution/SubmitContribution'

function AuthRequiredSubmit({ onSignIn }) {
  return (
    <section className="workspace">
      <div style={{
        textAlign: 'center',
        padding: '48px 32px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--info-border)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <h2 className="ty-section-title" style={{ margin: '0 0 10px' }}>Authentication Required</h2>
        <p className="ty-body" style={{ color: 'var(--text-muted)', margin: '0 auto 20px', maxWidth: '460px' }}>
          Evidence submission requires an active civic contributor account to maintain provenance and verification records.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="btn-landing-primary"
        >
          Sign In to Submit Evidence
        </button>
      </div>
    </section>
  )
}

function AuthRequiredContributions() {
  return (
    <section className="workspace">
      <div style={{ textAlign: 'center', padding: '48px 32px' }}>
        <p className="ty-body">Please sign in to view your contribution history.</p>
      </div>
    </section>
  )
}

export default function AppRoutes({
  activeUser,
  activeView,
  authMode,
  compareIds,
  comparisonState,
  currentRole,
  currentUser,
  dashboardState,
  formData,
  handleComparisonLookup,
  handlePoliticianLocalCreate,
  handlePoliticianLocalUpdate,
  handleSubmission,
  isAuthenticated,
  navigateTo,
  onUserUpdate,
  openPoliticianProfile,
  openSubmitContributionForPolitician,
  politiciansState,
  selectedPoliticianId,
  selectView,
  setAuthMode,
  setCompareIds,
  setFormDataField,
  setIsApprovedDomain,
  setIsAppealModalOpen,
  setIsCompareModalOpen,
  setIsPoliticiansModalOpen,
  setIsProfileModalOpen,
  setWgiMethodologyOpen,
  submissionState,
  token,
  triggerAuthPrompt,
  updateActionDetail,
}) {
  if (activeView === 'landing') {
    return (
      <Landing
        isAuthenticated={isAuthenticated}
        politicians={politiciansState.data}
        onAuthPrompt={triggerAuthPrompt}
        onExplorePoliticians={() => selectView('politicians')}
        onExploreDashboard={() => selectView('dashboard')}
        onSelectPolitician={(id) => openPoliticianProfile(id)}
        onCompare={() => selectView('compare')}
        onMethodologyClick={() => setWgiMethodologyOpen(true)}
      />
    )
  }

  if (activeView === 'auth') {
    return (
      <Authentication
        initialMode={authMode}
        onBack={() => navigateTo('politicians')}
      />
    )
  }

  if (activeView === 'politicians') {
    return (
      <PoliticiansLoaderPanel
        dbUser={currentUser}
        onViewProfile={openPoliticianProfile}
        politicians={politiciansState.data}
        politiciansState={politiciansState}
        state={dashboardState}
        onPoliticianUpdate={handlePoliticianLocalUpdate}
        onPoliticianCreate={handlePoliticianLocalCreate}
        onModalOpenChange={setIsPoliticiansModalOpen}
        token={token}
      />
    )
  }

  if (activeView === 'submit') {
    return isAuthenticated ? (
      <SubmitContribution
        formData={formData}
        onChange={setFormDataField}
        onDetailChange={updateActionDetail}
        onDomainCheck={setIsApprovedDomain}
        onSubmit={handleSubmission}
        selectedPoliticianId={selectedPoliticianId}
        state={submissionState}
        politicians={politiciansState.data}
      />
    ) : (
      <AuthRequiredSubmit
        onSignIn={() => {
          setAuthMode('login')
          navigateTo('auth')
        }}
      />
    )
  }

  if (activeView === 'profile') {
    return (
      <PoliticianProfilePage
        onAddContribution={openSubmitContributionForPolitician}
        onPoliticianUpdate={handlePoliticianLocalUpdate}
        onReload={openPoliticianProfile}
        onUserUpdate={onUserUpdate}
        onAppealModalOpenChange={setIsAppealModalOpen}
        onModalOpenChange={setIsProfileModalOpen}
        onAuthPrompt={triggerAuthPrompt}
        politicianId={selectedPoliticianId}
        politicians={politiciansState.data}
        state={dashboardState}
        dbUser={currentUser}
        token={token}
        user={activeUser}
      />
    )
  }

  if (activeView === 'dashboard') {
    return (
      <Dashboard
        isLoading={politiciansState.status === 'loading'}
        onNavigate={navigateTo}
        onOpenProfile={openPoliticianProfile}
        politicians={politiciansState.data}
        user={activeUser}
      />
    )
  }

  if (activeView === 'compare') {
    return (
      <ComparisonPanel
        compareIds={compareIds}
        onChange={setCompareIds}
        onModalOpenChange={setIsCompareModalOpen}
        onSubmit={handleComparisonLookup}
        politicians={politiciansState.data}
        politiciansState={politiciansState}
        state={comparisonState}
      />
    )
  }

  if (activeView === 'contributions') {
    return isAuthenticated ? (
      <MyContributionsPanel onNavigateToSubmit={() => navigateTo('submit')} user={activeUser} />
    ) : (
      <AuthRequiredContributions />
    )
  }

  if (activeView === 'profileMatrix') {
    return <ProfileMatrix token={token} user={activeUser} />
  }

  if (activeView === 'moderation') {
    return currentRole === 'CONTRIBUTOR'
      ? <RestrictedModerationAccess />
      : <ModerationPanel token={token} user={activeUser} />
  }

  if (activeView === 'account') {
    return <Account token={token} user={activeUser} />
  }

  if (activeView === 'history') {
    return <History token={token} />
  }

  return null
}
