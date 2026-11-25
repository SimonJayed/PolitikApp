import React, { useState } from 'react';
import { getKpisForPosition, getPositionGroupLabel, computeWgiCompositeScore } from './positionConfig';
import WgiMethodologyModal, { HelpCircleIcon } from './WgiMethodologyModal';

function resolveWgiScore(politician) {
  if (politician.wgiCompositeScore != null && Number.isFinite(Number(politician.wgiCompositeScore))) {
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

const descriptions = {
  billsAuthored: 'Number of sponsored bills or ordinances in verified records. Enactment is shown in the legislative record when available.',
  projectCompletions: 'Number of verified project completion records. When a record reports partial completion, its percentage appears with the record.',
  trackedBudgetAllocated: 'Budget allocations in the verified records, shown in Philippine pesos.',
  coaAuditDiscrepancies: 'Number of recorded Commission on Audit observations about public spending or compliance. The cited report can describe the audit period, agency response, and any later resolution.',
  legislativeEfficiencyRatio: 'Recorded project completions divided by sponsored bills or ordinances, expressed as a percentage. Higher values reflect more project completion per sponsored measure. The ratio is recorded as zero when there are no sponsored measures.',
}

export default function KPIWidget({ profile, compact = false, onModalOpenChange, showExplanations = false }) {
  const [dialog, setDialog] = useState(null);
  const isModalOpen = Boolean(dialog);

  React.useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);

  if (!profile) return null;

  const metrics = getKpisForPosition(profile.position, profile);
  const groupLabel = getPositionGroupLabel(profile.position);
  const wgiScore = showExplanations && profile.wgiCompositeScore == null ? null : resolveWgiScore(profile);

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
          <strong style={{ color: 'var(--text-primary)' }}>{wgiScore == null || !Number.isFinite(wgiScore) ? 'Unavailable' : wgiScore.toFixed(1)}</strong>
          <span className="kpi-wgi-pillar">Overall Performance Index</span>
          {!compact && (
            <button
              onClick={() => setDialog({})}
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
              aria-label="Open WGI scoring methodology"
              title="Open WGI scoring methodology"
            >
              <HelpCircleIcon size={16} />
            </button>
          )}
        </article>

        {metrics.map(({ key, label, value, unavailable, wgiPillar }) => (
          <article className={key === 'coaAuditDiscrepancies' ? 'kpiCard kpiCardAudit' : 'kpiCard'} key={label}>
            <span className="ty-label">{label}</span>
            <strong>{unavailable ? 'Unavailable' : value ?? 'Unavailable'}</strong>
            <span className="kpi-wgi-pillar">{wgiPillar}</span>
            {showExplanations && descriptions[key] && <button type="button" className="wgiMetricHelp"
              aria-label={'About ' + label} onClick={() => setDialog({ label, wgiPillar, description: descriptions[key] })}>
              <HelpCircleIcon size={16} />
            </button>}
          </article>
        ))}
      </section>

      {dialog && <WgiMethodologyModal
        isOpen
        onClose={() => setDialog(null)}
        initialPosition={profile.position}
        indicator={dialog.label ? { ...dialog, onOpenGuide: () => setDialog({}) } : null}
      />}
    </>
  );
}


