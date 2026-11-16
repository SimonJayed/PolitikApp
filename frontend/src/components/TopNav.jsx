import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDownIcon,
  FileTextIcon,
  GitCompareIcon,
  GavelIcon,
  HomeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  UserCircleIcon,
  UsersIcon,
  XIcon,
} from './icons/Lucide'
import politikappLogo from '../assets/politikapp.png'
import './TopNav.css'

function CenterNavItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`ty-nav hoverNavItem${active ? ' isActive' : ''}`}
    >
      <span className="hoverNavItemIcon">
        <Icon size={21} />
      </span>
      <span className="hoverNavItemLabel">{label}</span>
    </button>
  )
}

function MobileMenuItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'ty-nav flex min-h-[48px] w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left transition-all duration-200 active:scale-[0.98]',
        active
          ? 'bg-white/15 text-white ring-1 ring-white/20 font-bold'
          : 'text-[#E2E8F0] hover:bg-white/8 hover:text-white font-medium',
      ].join(' ')}
    >
      <Icon size={20} className={active ? 'text-[color:var(--ph-gold)]' : 'text-white/70'} />
      <span className="flex-1 text-[15px]">{label}</span>
      {active && (
        <span className="h-2 w-2 rounded-full bg-[color:var(--ph-gold)] shadow-[0_0_8px_var(--ph-gold)]" />
      )}
    </button>
  )
}

function TopNav({
  activeView,
  isCompareModalOpen = false,
  isModalOpen = false,
  onAuthClick,
  onLogout,
  onSelectView,
  title = 'PolitikApp',
  user,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navContainerRef = useRef(null)

  const isAuthenticated = Boolean(user && user.userId)
  const currentRole = user?.role || 'CONTRIBUTOR'
  const displayName = user?.fullName || user?.username || user?.email || 'User'

  // Close menus on click-outside or Escape key press (industry-standard mobile/desktop behavior)
  useEffect(() => {
    if (!mobileOpen && !userMenuOpen) return

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setUserMenuOpen(false)
      }
    }

    function handleClickOutside(e) {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target)) {
        setMobileOpen(false)
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [mobileOpen, userMenuOpen])

  // Automatically close mobile dropdown if viewport is resized to desktop/wide screen (>= 840px)
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 840) {
        setMobileOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navItems = useMemo(() => {
    const items = [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
      { key: 'politicians', label: 'Politicians', icon: UsersIcon },
      { key: 'compare', label: 'Compare', icon: GitCompareIcon },
    ]

    if (!isAuthenticated) {
      items.unshift({ key: 'landing', label: 'Home', icon: HomeIcon })
    }

    if (isAuthenticated) {
      if (currentRole === 'ADMIN') {
        items.push({ key: 'moderation', label: 'Moderation', icon: GavelIcon })
      }
      if (currentRole === 'ADMIN') {
        items.push({ key: 'adminNews', label: 'News Admin', icon: FileTextIcon })
        items.push({ key: 'openCongress', label: 'Congress Data', icon: FileTextIcon })
      }
    }

    return items
  }, [currentRole, isAuthenticated])

  function navigate(viewKey) {
    onSelectView(viewKey)
    setMobileOpen(false)
    setUserMenuOpen(false)
  }

  const hideTopNav = isCompareModalOpen || isModalOpen
  const isCompareActive = activeView === 'compare' && !hideTopNav

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 lg:px-8 sm:pt-4"
      style={hideTopNav ? { visibility: 'hidden' } : undefined}
      aria-hidden={hideTopNav}
    >
      <div ref={navContainerRef} className="topNavFrame pointer-events-auto mx-auto">
        <div
          className="topNavShell border border-white/10 shadow-[0_24px_60px_rgba(10,29,66,0.45)] backdrop-blur-xl"
          style={{
            background:
              'linear-gradient(160deg, rgba(10,29,66,0.98) 0%, rgba(7,16,40,0.98) 55%, rgba(10,29,66,0.94) 100%)',
          }}
        >
          <div className="topNavRow relative flex min-h-[58px] items-center justify-between gap-3 px-4 py-2 sm:min-h-[64px] sm:px-6 lg:min-h-[72px] lg:gap-4 lg:px-8 lg:py-2">
            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(18,42,88,0.72)] ring-1 ring-white/10 sm:h-11 sm:w-11">
                <img src={politikappLogo} alt="PolitikApp logo" className="topNavLogo" />
              </div>

              <div className="shrink-0">
                <div className="ty-nav whitespace-nowrap text-[16px] font-extrabold tracking-tight text-white sm:text-[18px]">
                  {title}
                </div>
              </div>
            </div>

            {/* Default Horizontal Navigation Bar: Shown on screens >= 840px, disappears when < 840px */}
            <nav aria-label="Primary" className="hoverNav topNavHorizontalNav">
              {navItems.map((item) => (
                <CenterNavItem
                  key={item.key}
                  active={item.key === 'compare' ? isCompareActive : activeView === item.key}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => navigate(item.key)}
                />
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Hamburger Button: Shown only on narrow/vertical viewports (< 840px), disappears on >= 840px */}
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className={`ty-nav topNavHamburgerBtn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/90 ring-1 ring-white/10 transition sm:h-12 sm:w-12 active:scale-95 ${
                  mobileOpen
                    ? 'bg-[rgba(42,68,120,0.95)] text-white ring-white/25'
                    : 'bg-[rgba(18,42,88,0.72)] hover:bg-[rgba(42,68,120,0.95)] hover:text-white'
                }`}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-dropdown"
                aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {mobileOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
              </button>

              {/* Wide Screen Horizontal Actions: Shown on >= 840px, hidden on < 840px where they tuck into hamburger */}
              {isAuthenticated ? (
                <div className="topNavHorizontalActions relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="ty-nav inline-flex h-11 items-center gap-2.5 rounded-xl bg-[rgba(18,42,88,0.72)] px-3 text-white/90 ring-1 ring-white/10 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white lg:h-12 lg:gap-2 lg:px-3"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    aria-label="User menu"
                  >
                    <UserCircleIcon size={20} />
                    <span className="max-w-[120px] truncate font-semibold">
                      {displayName}
                    </span>
                    <ChevronDownIcon size={16} className="text-white/70" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--ph-blue)]/95 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                      <div className="px-4 py-3">
                        <div className="ty-meta text-white/60">Signed in as</div>
                        <div className="ty-nav truncate font-semibold text-white">{displayName}</div>
                      </div>

                      <div className="h-px bg-white/10" />

                      <div className="p-2 user-menu-list">
                        <button
                          type="button"
                          onClick={() => navigate('profileMatrix')}
                          className="ty-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/90 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white"
                        >
                          <UserCircleIcon size={20} />
                          <span>My Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('account')}
                          className="ty-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/90 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white"
                        >
                          <SettingsIcon size={20} />
                          <span>Settings</span>
                        </button>
                        <button
                          type="button"
                          onClick={onLogout}
                          className="ty-nav mt-1 flex w-full items-center gap-3 rounded-xl border-t border-white/10 px-3 py-2.5 pt-3 text-left text-red-200 transition hover:bg-[color:var(--ph-red)]/20 hover:text-white"
                        >
                          <LogOutIcon size={20} />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="topNavHorizontalActions items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    id="topnav-signin-btn"
                    onClick={() => {
                      onAuthClick?.('login')
                      setMobileOpen(false)
                    }}
                    className="ty-nav inline-flex h-11 items-center justify-center rounded-xl px-3.5 text-[#E2E8F0] transition hover:bg-white/10 hover:text-white"
                  >
                    Sign In
                  </button>

                  <button
                    type="button"
                    id="topnav-register-btn"
                    onClick={() => {
                      onAuthClick?.('register')
                      setMobileOpen(false)
                    }}
                    className="ty-nav inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--ph-red)] px-3.5 sm:px-4 text-white font-semibold ring-1 ring-[color:var(--ph-red-soft)]/60 shadow-sm transition hover:bg-[color:var(--ph-red-soft)] hover:text-white"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Vertical Dropdown Drawer for Narrow Screens (< 840px) */}
          {mobileOpen && (
            <div
              id="mobile-nav-dropdown"
              className="mobileNavDropdown border-t border-white/10 px-4 py-4"
            >
              {/* Primary Navigation Items */}
              <div className="flex flex-col gap-1.5">
                {navItems.map((item) => (
                  <MobileMenuItem
                    key={`m-${item.key}`}
                    active={item.key === 'compare' ? isCompareActive : activeView === item.key}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => navigate(item.key)}
                  />
                ))}
              </div>

              <div className="my-3.5 h-px bg-white/10" />

              {/* Authenticated / Guest Actions Tucked Inside the Hamburger Menu */}
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <UserCircleIcon size={26} className="text-[color:var(--ph-gold)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                        Signed in as
                      </div>
                      <div className="truncate text-[14px] font-bold text-white">
                        {displayName}
                      </div>
                    </div>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                      {currentRole}
                    </span>
                  </div>

                  <MobileMenuItem
                    active={activeView === 'profileMatrix'}
                    icon={UserCircleIcon}
                    label="My Profile"
                    onClick={() => navigate('profileMatrix')}
                  />
                  <MobileMenuItem
                    active={activeView === 'account'}
                    icon={SettingsIcon}
                    label="Settings"
                    onClick={() => navigate('account')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      onLogout()
                    }}
                    className="ty-nav flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-red-300 transition-all hover:bg-red-500/20 hover:text-white active:scale-[0.98]"
                  >
                    <LogOutIcon size={20} className="text-red-400" />
                    <span className="flex-1 text-[15px]">Log Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      onAuthClick?.('login')
                    }}
                    className="ty-nav inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white/10 px-4 text-[15px] font-semibold text-white ring-1 ring-white/15 transition-all hover:bg-white/15 active:scale-[0.98]"
                  >
                    Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      onAuthClick?.('register')
                    }}
                    className="ty-nav inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[color:var(--ph-red)] px-4 text-[15px] font-bold text-white ring-1 ring-[color:var(--ph-red-soft)]/60 shadow-[0_8px_20px_rgba(206,17,38,0.35)] transition-all hover:bg-[color:var(--ph-red-soft)] active:scale-[0.98]"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TopNav
