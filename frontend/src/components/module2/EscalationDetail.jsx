import React from 'react';
import { getLifecycleStageIndex } from '../LifecycleStageStrip';

const STAGES = ['SUBMITTED', 'JURY_REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED'];

export default function EscalationDetail({ card }) {
  if (!card) return null;

  const activeStage = getLifecycleStageIndex(card.queueStatus);

  return (
    <div className="escalation-detail-content">
      <p><strong>Contributor:</strong> <span className="anonymized-tag">Anonymized Peer</span></p>
      {card.queueStatus === 'APPEALED_PENDING' && (
        <p style={{ margin: '0 0 10px' }}>
          <span style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '999px',
            color: '#991b1b',
            display: 'inline-flex',
            fontFamily: 'var(--mono, monospace)',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            padding: '5px 10px',
          }}>
            APPEALED PENDING
          </span>
        </p>
      )}
      <p><strong>Queue ID:</strong> {card.queueId}</p>
      <p><strong>Target Reference:</strong> {card.politicianId || 'SYSTEM-MAIN-TRACK'}</p>
      <p>
        <strong>Source Link:</strong>{' '}
        <a href={card.sourceUrl} rel="noreferrer" target="_blank">{card.sourceUrl}</a>
      </p>
      {card.impactSummary && <div className="summary-box" style={{ borderLeftColor: 'var(--ph-gold)' }}>"{card.impactSummary}"</div>}

      <div className="detailsBlock" style={{ marginTop: '4px', background: '#fffbeb', borderColor: '#fef3c7' }}>
        <h5 className="ty-label" style={{ margin: 0 }}>Adjudication Lifecycle</h5>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
            {STAGES.map((stage, index) => (
              <span
                key={`${card.queueId}-admin-${stage}`}
                style={{
                  textAlign: 'center',
                  padding: '6px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid #d1d5db',
                  background: index <= activeStage ? '#d97706' : '#f8fafc',
                  color: index <= activeStage ? '#ffffff' : '#64748b',
                  transition: 'all 220ms ease',
                }}
              >
                {stage.replace('_', ' ')}
              </span>
            ))}
          </div>
          <p className="ty-meta" style={{ margin: 0, color: 'var(--ph-gold)' }}>
            Current status: <strong>{card.queueStatus}</strong> ({card.queueStatus === 'APPEALED_PENDING' ? 'Post-publish appeal awaiting administrator adjudication' : 'Escalated to Administrator override'})
          </p>
        </div>
      </div>

      <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #dbe5ea', fontSize: '13px', display: 'flex', justifyContent: 'space-around' }}>
        <div>Community Agree Weight: <strong style={{ color: '#16a34a' }}>{card.agreeSum}</strong></div>
        <div>Community Disagree Weight: <strong style={{ color: '#dc2626' }}>{card.disagreeSum}</strong></div>
      </div>
    </div>
  );
}
