import { TRUST_APPEAL_UNLOCK, TRUST_BASE, TRUST_MAX, clampTrustScore, getTrustScoreBand } from './trustScore';

export default function TrustScoreMeter({
  appealEligible,
  className = '',
  score,
  showEligibility = true,
  theme = 'light',
  variant = 'full',
}) {
  const value = clampTrustScore(score);
  const band = getTrustScoreBand(value);
  const percentage = (value / TRUST_MAX) * 100;
  const basePosition = (TRUST_BASE / TRUST_MAX) * 100;
  const compact = variant === 'compact';
  const inline = variant === 'inline';
  const eligible = appealEligible ?? value >= TRUST_APPEAL_UNLOCK;
  const mutedText = theme === 'dark' ? '#cbd5e1' : '#64748b';
  const mainText = theme === 'dark' ? '#f8fafc' : '#0f172a';

  const rootStyle = {
    background: inline ? 'transparent' : theme === 'dark' ? '#0f172a' : '#ffffff',
    border: inline ? '0' : theme === 'dark' ? '1px solid #334155' : '1px solid rgba(15, 23, 42, 0.10)',
    borderRadius: inline ? '0' : '8px',
    boxShadow: inline ? 'none' : '0 10px 24px rgba(15, 23, 42, 0.06)',
    color: mainText,
    display: 'grid',
    gap: compact ? '8px' : '10px',
    minWidth: inline ? '0' : '220px',
    padding: inline ? '0' : compact ? '12px' : '16px',
  };

  return (
    <section className={className} style={rootStyle}>
      <div style={{ alignItems: 'center', display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: mutedText, display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
            Trust Score
          </span>
          <strong style={{ color: band.color, display: 'block', fontSize: compact || inline ? '24px' : '34px', lineHeight: 1 }}>
            {Math.round(value)}
          </strong>
        </div>
        <span style={{
          background: band.soft,
          border: `1px solid ${band.color}33`,
          borderRadius: '999px',
          color: band.color,
          fontSize: '11px',
          fontWeight: 900,
          padding: '5px 9px',
          whiteSpace: 'nowrap',
        }}>
          {band.label}
        </span>
      </div>

      <div>
        <div style={{
          background: 'linear-gradient(90deg, #b91c1c 0%, #d97706 20%, #475569 20%, #475569 21%, #2563eb 30%, #0891b2 50%, #15803d 80%, #7c3aed 100%)',
          borderRadius: '999px',
          height: compact || inline ? '8px' : '10px',
          position: 'relative',
        }}>
          <span style={{
            background: '#ffffff',
            border: `2px solid ${band.color}`,
            borderRadius: '999px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.22)',
            height: compact || inline ? '16px' : '18px',
            left: `${percentage}%`,
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: compact || inline ? '16px' : '18px',
          }} />
          <span style={{
            background: '#0f172a',
            borderRadius: '999px',
            height: '18px',
            left: `${basePosition}%`,
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '3px',
          }} />
        </div>
        {!compact && !inline && (
          <div style={{ color: mutedText, display: 'flex', fontSize: '10px', fontWeight: 800, justifyContent: 'space-between', marginTop: '7px' }}>
            <span>0</span>
            <span>Base 100</span>
            <span>Unlock 150</span>
            <span>500</span>
          </div>
        )}
      </div>

      {showEligibility && (
        <p style={{ color: eligible ? '#047857' : '#b45309', fontSize: compact || inline ? '12px' : '13px', fontWeight: 800, margin: 0 }}>
          {eligible ? 'Appeal eligible' : 'Appeals unlock at 150'}
        </p>
      )}
    </section>
  );
}
