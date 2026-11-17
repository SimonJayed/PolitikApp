import {
  LayoutDashboardIcon,
  UsersIcon,
  GitCompareIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '../../../components/icons/Lucide'

export function MobileBottomNav({
  activeView,
  onNavigate,
  user,
  isAuthenticated,
  isKeyboardOpen,
}) {
  // Hide bottom nav in auth view or when software keyboard is open
  if (activeView === 'auth') return null

  const items = [
    {
      key: 'dashboard',
      label: 'News',
      icon: LayoutDashboardIcon,
      match: ['dashboard', 'landing'],
    },
    {
      key: 'politicians',
      label: 'Directory',
      icon: UsersIcon,
      match: ['politicians', 'profile', 'submit'],
    },
    {
      key: 'compare',
      label: 'Compare',
      icon: GitCompareIcon,
      match: ['compare'],
    },
    {
      key: isAuthenticated ? (user?.role === 'ADMIN' ? 'adminNews' : 'account') : 'auth',
      label: isAuthenticated ? (user?.role === 'ADMIN' ? 'Admin' : 'Account') : 'Sign In',
      icon: isAuthenticated ? (user?.role === 'ADMIN' ? ShieldCheckIcon : UserCircleIcon) : SettingsIcon,
      match: ['account', 'adminNews', 'openCongress', 'moderation', 'profileMatrix'],
    },
  ]

  return (
    <nav
      className={`mobileBottomNav ${isKeyboardOpen ? 'keyboardOpen' : ''}`}
      role="navigation"
      aria-label="Bottom navigation"
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.match.includes(activeView)

        return (
          <button
            key={item.key}
            type="button"
            className={`mobileNavItem ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="navIconIndicator">
              <Icon size={20} />
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default MobileBottomNav

