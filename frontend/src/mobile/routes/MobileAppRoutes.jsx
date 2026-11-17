import TopNav from '../../components/TopNav'
import AuthPromptModal from '../../components/AuthPromptModal'
import WgiMethodologyModal from '../../components/governance/WgiMethodologyModal'
import AppRoutes from '../../routes/AppRoutes'
import { AlertTriangleIcon } from '../../components/icons/Lucide'
import '../styles/mobile.css'

export default function MobileAppRoutes(props) {
  const {
    activeHeader,
    activeUser,
    activeView,
    authModalConfig,
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
    isAnyModalOpen,
    isAppealModalOpen,
    isCompareModalOpen,
    isPoliticiansModalOpen,
    isProfileModalOpen,
    isWgiMethodologyOpen,
    navigateTo,
    notFoundNotice,
    onLogout,
    onUserUpdate,
    openPoliticianProfile,
    openSubmitContributionForPolitician,
    politiciansState,
    selectedPoliticianId,
    selectView,
    setAuthModalConfig,
    setAuthMode,
    setCompareIds,
    setFormDataField,
    setIsAppealModalOpen,
    setIsApprovedDomain,
    setIsCompareModalOpen,
    setIsPoliticiansModalOpen,
    setIsProfileModalOpen,
    setIsWgiMethodologyOpen,
    setNotFoundNotice,
    setWgiMethodologyOpen,
    showHeaderTitles,
    submissionState,
    token,
    triggerAuthPrompt,
    updateActionDetail,
  } = props

  return (
    <div className="mobileAppShell">
      {activeView !== 'auth' && (
        <TopNav
          activeView={activeView}
          isCompareModalOpen={isCompareModalOpen}
          isModalOpen={isAnyModalOpen || authModalConfig?.isOpen || isWgiMethodologyOpen}
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

      <main
        className={
          activeView === 'auth'
            ? 'pageContent authPageContent'
            : `${isAnyModalOpen ? 'pageContent pt-0' : 'pageContent pt-24 sm:pt-28'} ${activeView === 'landing' ? '' : 'pageContentAligned'}`
        }
        role="main"
      >
        {!isAnyModalOpen && showHeaderTitles && (
          <header className="topBar">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-(--accent-soft) text-(--ph-blue) ring-1 ring-black/5">
                <span className="ty-nav font-extrabold" aria-hidden="true">
                  {activeHeader?.[0]?.slice(0, 1) || 'P'}
                </span>
              </div>

              <div className="min-w-0">
                <p className="ty-label">{activeHeader?.[0]}</p>
                <p className="ty-nav truncate text-(--text-primary)">{activeHeader?.[1]}</p>
              </div>
            </div>
          </header>
        )}

        {notFoundNotice && (
          <div
            style={{
              margin: '12px 0 20px',
              padding: '12px 20px',
              borderRadius: '12px',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <span>
              <AlertTriangleIcon size={16} /> {notFoundNotice}
            </span>
            <button
              type="button"
              onClick={() => setNotFoundNotice?.('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#92400e',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        )}

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
          setFormDataField={setFormDataField}
          setIsApprovedDomain={setIsApprovedDomain}
          setIsAppealModalOpen={setIsAppealModalOpen}
          setIsCompareModalOpen={setIsCompareModalOpen}
          setIsPoliticiansModalOpen={setIsPoliticiansModalOpen}
          setIsProfileModalOpen={setIsProfileModalOpen}
          setWgiMethodologyOpen={setWgiMethodologyOpen}
          submissionState={submissionState}
          token={token}
          triggerAuthPrompt={triggerAuthPrompt}
          updateActionDetail={updateActionDetail}
        />
      </main>

      <AuthPromptModal
        isOpen={authModalConfig?.isOpen}
        actionType={authModalConfig?.actionType}
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
    </div>
  )
}
