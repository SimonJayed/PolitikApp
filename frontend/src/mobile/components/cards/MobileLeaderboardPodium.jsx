import { formatJurisdiction, formatPosition } from '../../../components/governance/positionConfig'
import { formatWgiScore } from '../../../features/congress/wgiLeaderboard'

function RankBadge({ rank }) {
  const colors = {
    1: { bg: '#FEF3C7', border: '#F59E0B', text: '#B45309', label: '1st' },
    2: { bg: '#F1F5F9', border: '#94A3B8', text: '#475569', label: '2nd' },
    3: { bg: '#FFEDD5', border: '#F97316', text: '#C2410C', label: '3rd' },
  }
  const current = colors[rank] || { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', label: `#${rank}` }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '32px',
      height: '24px',
      padding: '0 8px',
      borderRadius: '12px',
      backgroundColor: current.bg,
      border: `1px solid ${current.border}`,
      color: current.text,
      fontSize: '0.75rem',
      fontWeight: 800,
      flexShrink: 0,
    }}>
      {current.label}
    </span>
  )
}

export function MobileLeaderboardPodium({ entries = [], onSelectPolitician }) {
  const topThree = entries.slice(0, 3)
  if (topThree.length === 0) return null

  return (
    <div style={{
      background: 'linear-gradient(145deg, #122a58 0%, #1e3a8a 100%)',
      borderRadius: '16px',
      padding: '16px',
      color: '#ffffff',
      marginBottom: '16px',
      boxShadow: '0 4px 14px rgba(18, 42, 88, 0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 style={{
          margin: 0,
          fontSize: '0.875rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.85)',
        }}>
          Top WGI Leaders
        </h2>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          Manila Standard
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {topThree.map((entry) => {
          const tags = [formatPosition(entry.position), formatJurisdiction(entry.jurisdiction)].filter(Boolean)

          return (
            <button
              key={entry.politicianId}
              type="button"
              onClick={() => onSelectPolitician?.(entry.politicianId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                textAlign: 'left',
                width: '100%',
                minHeight: '48px',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              <RankBadge rank={entry.rank || 1} />

              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                fontSize: '0.8125rem',
                fontWeight: 700,
              }}>
                {entry.profileImageUrl ? (
                  <img
                    src={entry.profileImageUrl}
                    alt={entry.fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ) : (
                  String(entry.fullName || '').slice(0, 2).toUpperCase()
                )}
              </div>

              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {entry.fullName}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {tags.join(' · ') || 'Public Official'}
                </div>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#FCD34D' }}>
                  {formatWgiScore(entry.overallScore)}
                </span>
                <span style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  WGI Score
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MobileLeaderboardPodium

