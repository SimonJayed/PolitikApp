import React from 'react';

export default function AdminEscalationActions({
  queueId,
  voteReason,
  onUpdateReason,
  onOverride,
}) {
  return (
    <div className="ballot-console">
      <h4 className="ty-card-title" style={{ margin: 0 }}>Admin Override Resolution</h4>
      
      <input
        className="justification-input"
        onChange={(e) => onUpdateReason(e.target.value)}
        placeholder="Administrative override justification reason (REQUIRED)..."
        type="text"
        value={voteReason || ''}
        style={{ border: '1px solid var(--ph-gold)' }}
      />

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          className="btn-submit-ballot"
          onClick={() => onOverride(queueId, 'PUBLISHED')}
          type="button"
          style={{ background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)' }}
        >
          Publish Override
        </button>
        <button
          className="btn-submit-ballot"
          onClick={() => onOverride(queueId, 'REJECTED')}
          type="button"
          style={{ background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)' }}
        >
          Reject Override
        </button>
      </div>
    </div>
  );
}
