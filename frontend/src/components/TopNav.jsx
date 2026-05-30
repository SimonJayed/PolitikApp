import { useMemo, useState } from 'react'
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext'
import {
  ChevronDownIcon,
  GitCompareIcon,
  GavelIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  SunIcon,
  UserCircleIcon,
  UsersIcon,
} from './icons/Lucide'

function CenterNavItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'ty-nav group relative flex h-16 w-[125px] flex-col items-center justify-center gap-1 rounded-2xl px-4',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ph-gold)]/70',
        active
          ? 'bg-[rgba(32,55,103,0.95)] text-white ring-1 ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]'
          : 'bg-[rgba(18,42,88,0.72)] text-white/85 ring-1 ring-white/10 hover:bg-[rgba(42,68,120,0.95)] hover:text-white',
      ].join(' ')}
    >
      <Icon size={20} className="text-current transition-all duration-200" />

      <span className="text-[13px] font-semibold leading-none text-current transition-all duration-200">
        {label}
      </span>

      {active && (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[color:var(--ph-gold)]"
        />
      )}
    </button>
  )
}

function MobileMenuItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'ty-nav flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200',
        active
          ? 'bg-[rgba(32,55,103,0.95)] text-white ring-1 ring-white/20'
          : 'bg-[rgba(18,42,88,0.72)] text-white/85 ring-1 ring-white/10 hover:bg-[rgba(42,68,120,0.95)] hover:text-white',
      ].join(' ')}
    >
      <Icon size={20} />
      <span className="flex-1">{label}</span>
      {active && <span className="h-1.5 w-8 rounded-full bg-[color:var(--ph-gold)]" />}
    </button>
  )
}

function TopNav({ activeView, isCompareModalOpen = false, isModalOpen = false, onLogout, onSelectView, title = 'PolitikApp', user }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const sandboxContext = useDeveloperSandbox()
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null
  const currentRole = isDevModeActive && manipulatedUser ? manipulatedUser.role : (user?.role || 'CONTRIBUTOR')

  const navItems = useMemo(() => {
    const items = [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
      { key: 'directory', label: 'Politicians', icon: UsersIcon },
      { key: 'compare', label: 'Compare', icon: GitCompareIcon },
      { key: 'contributions', label: 'Contributions', icon: HistoryIcon },
    ]

    if (currentRole !== 'CONTRIBUTOR') {
      items.push({ key: 'moderation', label: 'Moderation', icon: GavelIcon })
    }

    return items
  }, [currentRole])

  function navigate(viewKey) {
    onSelectView(viewKey)
    setMobileOpen(false)
    setUserMenuOpen(false)
  }

  const hideTopNav = isCompareModalOpen || isModalOpen
  const isCompareActive = activeView === 'compare' && !hideTopNav

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4"
      style={hideTopNav ? { visibility: 'hidden' } : undefined}
      aria-hidden={hideTopNav}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-[1880px]">
        <div
          className="rounded-[30px] border border-white/10 shadow-[0_24px_60px_rgba(10,29,66,0.45)] backdrop-blur-xl"
          style={{
            background:
              'linear-gradient(160deg, rgba(10,29,66,0.98) 0%, rgba(7,16,40,0.98) 55%, rgba(10,29,66,0.94) 100%)',
          }}
        >
          <div className="flex min-h-[96px] items-center justify-between gap-5 px-6 py-4 md:px-8">
            <div className="flex min-w-[240px] items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(18,42,88,0.72)] ring-1 ring-white/10">
                <SunIcon size={24} className="text-[color:var(--ph-gold)]" />
              </div>

              <div className="min-w-0">
                <div className="ty-nav truncate text-[18px] font-extrabold text-white">
                  {title}
                </div>
                <div className="ty-meta truncate text-[13px] font-medium text-white/60">
                  Insights. Leaders. Change.
                </div>
              </div>
            </div>

            <nav aria-label="Primary" className="hidden flex-1 items-center justify-center gap-2 xl:flex">
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

            <div className="flex min-w-fit items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="ty-nav inline-flex h-12 items-center justify-center rounded-2xl bg-[rgba(18,42,88,0.72)] px-4 text-white/90 ring-1 ring-white/10 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white xl:hidden"
                aria-expanded={mobileOpen}
                aria-label="Open navigation menu"
              >
                <MenuIcon size={22} />
              </button>

              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="ty-nav inline-flex h-14 items-center gap-3 rounded-2xl bg-[rgba(18,42,88,0.72)] px-4 text-white/90 ring-1 ring-white/10 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white"
                  aria-expanded={userMenuOpen}
                  aria-label="User menu"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--ph-red)]/90 text-white">
                    <UserCircleIcon size={22} />
                  </span>
                  <span className="max-w-[140px] truncate font-semibold">
                    {user?.username || 'User'}
                  </span>
                  <ChevronDownIcon size={17} className="text-white/70" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--ph-blue)]/95 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className="px-4 py-3">
                      <div className="ty-meta text-white/60">Signed in as</div>
                      <div className="ty-nav truncate font-semibold text-white">
                        {user?.username || 'User'}
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div className="p-2 user-menu-list">
                      <button
                        type="button"
                        onClick={() => navigate('profileMatrix')}
                        className="ty-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/90 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white"
                      >
                        <UserCircleIcon size={21} />
                        <span>My Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('account')}
                        className="ty-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/90 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white"
                      >
                        <SettingsIcon size={24} />
                        <span>Settings</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('history')}
                        className="ty-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/90 transition hover:bg-[rgba(42,68,120,0.95)] hover:text-white"
                      >
                        <HistoryIcon size={21} />
                        <span>History</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="ty-nav inline-flex h-14 items-center gap-3 rounded-2xl bg-[rgba(18,42,88,0.72)] px-4 text-white/90 ring-1 ring-white/10 transition hover:bg-[color:var(--ph-red)]/80 hover:text-white"
              >
                <LogOutIcon size={22} />
                <span className="hidden font-semibold sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="border-t border-white/10 px-4 pb-4 xl:hidden">
              <div className="mt-4 grid gap-2 rounded-2xl bg-[rgba(18,42,88,0.35)] p-2 ring-1 ring-white/10">
                {navItems.map((item) => (
                  <MobileMenuItem
                    key={`m-${item.key}`}
                    active={item.key === 'compare' ? isCompareActive : activeView === item.key}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => navigate(item.key)}
                  />
                ))}

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

                <MobileMenuItem
                  active={activeView === 'history'}
                  icon={HistoryIcon}
                  label="History"
                  onClick={() => navigate('history')}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TopNav
