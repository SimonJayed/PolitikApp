import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard'
import MobileHeader from './MobileHeader'
import MobileBottomNav from './MobileBottomNav'
import '../../styles/mobile.css'

export function MobileAppShell({
  children,
  activeView,
  onNavigate,
  user,
  isAuthenticated,
  onLogout,
  onAuthPrompt,
  headerTitle,
}) {
  const isKeyboardOpen = useVirtualKeyboard()
  const isAuthView = activeView === 'auth'

  return (
    <div className="mobileAppShell">
      {!isAuthView && (
        <MobileHeader
          activeView={activeView}
          user={user}
          isAuthenticated={isAuthenticated}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onAuthPrompt={onAuthPrompt}
          title={headerTitle}
        />
      )}

      <main
        className={`mobileMainContent ${isAuthView ? 'noHeader noBottomNav' : ''} ${isKeyboardOpen ? 'noBottomNav' : ''}`}
        role="main"
      >
        {children}
      </main>

      {!isAuthView && (
        <MobileBottomNav
          activeView={activeView}
          onNavigate={onNavigate}
          user={user}
          isAuthenticated={isAuthenticated}
          isKeyboardOpen={isKeyboardOpen}
        />
      )}
    </div>
  )
}

export default MobileAppShell

