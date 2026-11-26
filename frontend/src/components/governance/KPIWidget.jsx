import React, { useState } from 'react';
import { getKpisForPosition, getPositionGroupLabel, computeWgiCompositeScore } from './positionConfig';
import WgiMethodologyModal, { HelpCircleIcon } from './WgiMethodologyModal';
import { BarChart3Icon, CircleCheckIcon, FileTextIcon, LandmarkIcon, ScaleIcon, SearchIcon } from '../icons/Lucide';

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

const indicatorIcons = {
  wgiCompositeScore: BarChart3Icon,
  billsAuthored: FileTextIcon,
  projectCompletions: CircleCheckIcon,
  trackedBudgetAllocated: LandmarkIcon,
  coaAuditDiscrepancies: SearchIcon,
  legislativeEfficiencyRatio: ScaleIcon,
}

export default function KPIWidget({ profile, compact = false, onModalOpenChange, showExplanations = false }) {
  const [dialog, setDialog] = useState(null);
  const isModalOpen = Boolean(dialog);

  React.useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);

  if (!profile) return null;

  const groupLabel = getPositionGroupLabel(profile.position);
  const wgiScore = showExplanations && profile.wgiCompositeScore == null ? null : resolveWgiScore(profile);
  const metrics = [
    {
      key: 'wgiCompositeScore',
      label: 'WGI Composite Score',
      value: wgiScore == null || !Number.isFinite(wgiScore) ? 'Unavailable' : wgiScore.toFixed(1),
      wgiPillar: 'Overall Performance Index',
    },
    ...getKpisForPosition(profile.position, profile),
  ];

  return (
    <>
      <section className={compact ? 'kpiGrid compact' : 'kpiGrid'} aria-label="Performance indicators">
        <div className="kpi-position-group-label" aria-label={`Position group: ${groupLabel}`}>
          <span>{groupLabel}</span>
          {showExplanations
            ? <h2 className="kpi-position-group-sublabel">WGI-Mapped Performance Indicators</h2>
            : <span className="kpi-position-group-sublabel">WGI-Mapped Performance Indicators</span>}
        </div>

        {metrics.map(({ key, label, value, unavailable, wgiPillar }) => {
          const composite = key === 'wgiCompositeScore';
          const Icon = indicatorIcons[key];
          const description = descriptions[key];
          const className = showExplanations ? 'kpiCard'
            : composite ? 'kpiCard wgiCardHighlight'
            : key === 'coaAuditDiscrepancies' ? 'kpiCard kpiCardAudit' : 'kpiCard';
          return (
            <article className={className} key={key} data-indicator={showExplanations ? key : undefined}
              style={composite && !showExplanations ? {
                borderLeft: '3px solid var(--info, #0070f3)',
                background: 'var(--accent-soft, #f4f6fa)',
              } : undefined}>
              {showExplanations && <div className="kpiIndicatorTop">
                {Icon && <span className="kpiIndicatorIcon"><Icon size={20} /></span>}
                {(composite || description) && <button type="button" className="kpiIndicatorHelp"
                  aria-label={composite ? 'Open WGI scoring methodology' : 'About ' + label} aria-haspopup="dialog"
                  onClick={() => setDialog(composite ? {} : { label, wgiPillar, description })}>
                  <HelpCircleIcon size={20} />
                </button>}
              </div>}
              <span className="ty-label">{label}</span>
              <strong>{unavailable ? 'Unavailable' : value ?? 'Unavailable'}</strong>
              <span className="kpi-wgi-pillar">{wgiPillar}</span>
              {composite && !showExplanations && !compact && (
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
          );
        })}
      </section>

      {dialog && <WgiMethodologyModal
        isOpen
        onClose={() => setDialog(null)}
        initialPosition={profile.position}
        indicator={dialog.label ? dialog : null}
      />}
    </>
  );
}


