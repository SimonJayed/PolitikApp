import { ArrowLeftIcon, UserCircleIcon, LogOutIcon, ShieldCheckIcon } from '../../../components/icons/Lucide'

export function MobileHeader({
  activeView,
  user,
  isAuthenticated,
  onNavigate,
  onLogout,
  onAuthPrompt,
  title,
}) {
  const showBack = ['profile', 'compare', 'auth', 'submit', 'account', 'adminNews', 'openCongress', 'profileMatrix'].includes(activeView)

  const handleBack = () => {
    if (activeView === 'profile' || activeView === 'submit') {
      onNavigate('politicians')
    } else if (activeView === 'auth') {
      onNavigate('landing')
    } else {
      onNavigate('dashboard')
    }
  }

  const getTitle = () => {
    if (title) return title
    switch (activeView) {
      case 'landing': return 'PolitikApp'
      case 'dashboard': return 'News & Feed'
      case 'politicians': return 'Directory'
      case 'profile': return 'Politician Profile'
      case 'compare': return 'Compare'
      case 'auth': return 'Sign In / Register'
      case 'account': return 'Account Settings'
      case 'adminNews': return 'Admin News Review'
      case 'openCongress': return 'Congress Ingestion'
      case 'profileMatrix': return 'Contributor Profile'
      default: return 'PolitikApp'
    }
  }

  return (
    <header className="mobileHeader" role="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '48px' }}>
        {showBack ? (
          <button
            type="button"
            className="mobileTouchTarget"
            onClick={handleBack}
            aria-label="Go back"
            style={{ color: '#ffffff' }}
          >
            <ArrowLeftIcon size={24} />
          </button>
        ) : (
          <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 10px #EF4444',
              }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <h1 className="mobileHeaderTitle">
        {getTitle()}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '48px', justifyContent: 'flex-end' }}>
        {isAuthenticated ? (
          <button
            type="button"
            className="mobileTouchTarget"
            onClick={() => onNavigate(user?.role === 'ADMIN' ? 'adminNews' : 'account')}
            aria-label={user?.role === 'ADMIN' ? 'Admin Panel' : 'Account profile'}
            style={{ color: '#ffffff' }}
          >
            {user?.role === 'ADMIN' ? <ShieldCheckIcon size={22} /> : <UserCircleIcon size={24} />}
          </button>
        ) : (
          <button
            type="button"
            className="mobileTouchTarget"
            onClick={() => onNavigate('auth')}
            style={{
              color: '#ffffff',
              fontSize: '0.8125rem',
              fontWeight: 700,
              padding: '0 8px',
            }}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  )
}

export default MobileHeader

