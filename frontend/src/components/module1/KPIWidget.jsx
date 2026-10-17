import React, { useState } from 'react';
import { getKpisForPosition, getPositionGroupLabel, computeWgiCompositeScore } from './positionConfig';
import WgiMethodologyModal, { HelpCircleIcon } from './WgiMethodologyModal';

function resolveWgiScore(politician) {
  if (Number.isFinite(Number(politician.wgiCompositeScore)) && Number(politician.wgiCompositeScore) > 0) {
    return Number(politician.wgiCompositeScore);
  }
  return computeWgiCompositeScore(
    politician.position,
    Number(politician.billsAuthored || 0),
    Number(politician.projectCompletions || 0),
    Number(politician.trackedBudgetAllocated || 0),
    0, // totalFlagged fallback
    Number(politician.coaAuditDiscrepancies || 0)
  );
}

export default function KPIWidget({ profile, compact = false, onModalOpenChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);

  if (!profile) return null;

  const metrics = getKpisForPosition(profile.position, profile);
  const groupLabel = getPositionGroupLabel(profile.position);
  const wgiScore = resolveWgiScore(profile);

  return (
    <>
      <section className={compact ? 'kpiGrid compact' : 'kpiGrid'} aria-label="Performance indicators">
        <div className="kpi-position-group-label" aria-label={`Position group: ${groupLabel}`}>
          <span>{groupLabel}</span>
          <span className="kpi-position-group-sublabel">WGI-Mapped Performance Indicators</span>
        </div>

        {/* Highlighted WGI Composite Score Card */}
        <article
          className="kpiCard wgiCardHighlight"
          style={{
            borderLeft: '3px solid var(--info, #0070f3)',
            background: 'var(--accent-soft, #f4f6fa)',
            position: 'relative'
          }}
        >
          <span className="ty-label">WGI Composite Score</span>
          <strong style={{ color: 'var(--text-primary)' }}>{wgiScore.toFixed(1)}</strong>
          <span className="kpi-wgi-pillar">Overall Performance Index</span>
          {!compact && (
            <button
              onClick={() => setIsModalOpen(true)}
              type="button"
              className="wgiMethodologyTrigger"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ph-blue, #0c1e4a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%',
              }}
              title="How is this calculated? Open WGI Methodology Guide"
            >
              <HelpCircleIcon size={16} />
            </button>
          )}
        </article>

        {metrics.map(({ label, value, isAlert, wgiPillar }) => (
          <article
            className={`kpiCard ${isAlert ? 'kpi-card-alert' : ''}`}
            key={label}
            title={`WGI Pillar: ${wgiPillar}`}
            style={isAlert ? { borderLeft: '3px solid var(--ph-gold)', background: '#fef9e8' } : {}}
          >
            <span className="ty-label">{label}</span>
            <strong style={isAlert ? { color: '#92660a' } : {}}>{value ?? 'N/A'}</strong>
            <span className="kpi-wgi-pillar" aria-label={`WGI Pillar: ${wgiPillar}`}>{wgiPillar}</span>
          </article>
        ))}
      </section>

      <WgiMethodologyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPosition={profile.position}
      />
    </>
  );
}


