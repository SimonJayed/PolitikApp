import {
  GitCompareIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from './icons/Lucide'
import './LandingPage.css'

export default function SiteFooter({
  isAuthenticated = false,
  onAuthPrompt,
  onExplorePoliticians,
  onExploreDashboard,
  onCompare,
}) {
  function requestGuestAccess(actionType = 'preview') {
    onAuthPrompt?.(actionType)
  }

  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <span>PolitikApp</span>
        </div>

        <div className="landing-footer-copy">
          Philippine Civic Transparency &amp; Primary-Source Public Official Audit Platform.
        </div>

        <div className="landing-footer-links">
          <button className="ty-nav" onClick={() => isAuthenticated ? onExplorePoliticians?.() : requestGuestAccess('preview')}>
            <UsersIcon size={17} />
            <span>Politicians</span>
          </button>
          <button className="ty-nav" onClick={() => isAuthenticated ? onExploreDashboard?.() : requestGuestAccess('preview')}>
            <LayoutDashboardIcon size={17} />
            <span>Dashboard</span>
          </button>
          <button className="ty-nav" onClick={() => isAuthenticated ? onCompare?.() : requestGuestAccess('preview')}>
            <GitCompareIcon size={17} />
            <span>Compare</span>
          </button>
        </div>
      </div>
    </footer>
  )
}
