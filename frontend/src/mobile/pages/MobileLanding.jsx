import { UsersIcon, LayoutDashboardIcon, GitCompareIcon } from '../../components/icons/Lucide'

export function MobileLanding({
  onExplorePoliticians,
  onExploreDashboard,
  onCompare,
  onAuthPrompt,
  isAuthenticated,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      paddingBottom: '24px',
    }}>
      {/* Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #122a58 0%, #1e3a8a 100%)',
        borderRadius: '20px',
        padding: '24px 20px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(18, 42, 88, 0.3)',
      }}>
        <span style={{
          display: 'inline-block',
          fontSize: '0.6875rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#FCD34D',
          marginBottom: '8px',
        }}>
          Civic Transparency Platform
        </span>

        <h1 style={{
          margin: '0 0 10px',
          fontSize: '1.625rem',
          fontWeight: 800,
          lineHeight: 1.25,
          fontFamily: 'var(--display, "Poppins", sans-serif)',
          letterSpacing: '-0.02em',
        }}>
          Philippine Governance, Verified by Evidence.
        </h1>

        <p style={{
          margin: '0 0 20px',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.85)',
        }}>
          Track verified congressional records, Worldwide Governance Indicators (WGI), and official announcements without algorithmic spin.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="mobileTouchTarget"
            onClick={onExplorePoliticians}
            style={{
              background: '#EF4444',
              color: '#ffffff',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.9375rem',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
            }}
          >
            Explore Public Officials
          </button>

          <button
            type="button"
            className="mobileTouchTarget"
            onClick={onExploreDashboard}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            View Verified News Feed
          </button>
        </div>
      </div>

      {/* Feature Navigation Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          type="button"
          onClick={onExplorePoliticians}
          className="mobileCard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px',
            margin: 0,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#EFF6FF',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <UsersIcon size={24} />
          </div>
          <div style={{ flex: '1 1 auto' }}>
            <h3 style={{ margin: '0 0 2px', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
              Officials Directory
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
              Rankings, positions, and track records across Congress.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onCompare}
          className="mobileCard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px',
            margin: 0,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#FAF5FF',
            color: '#7C3AED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <GitCompareIcon size={24} />
          </div>
          <div style={{ flex: '1 1 auto' }}>
            <h3 style={{ margin: '0 0 2px', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
              Compare Candidates
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
              Side-by-side evidence analysis and governance metrics.
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}

export default MobileLanding

