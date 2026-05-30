import React from 'react';

export default function VoteWeightIndicator({ weight, tierLabel, tone = 'neutral' }) {
  return (
    <article className={`matrixMetricCard ${tone}`} style={{ position: 'relative' }}>
      <span>Active Voting Weight</span>
      <strong style={{ fontSize: '2.2rem' }}>x{weight || 1}</strong>
      <small style={{
        position: 'absolute',
        bottom: '8px',
        right: '12px',
        fontSize: '9px',
        opacity: 0.8,
        letterSpacing: '0.05em'
      }}>
        {tierLabel}
      </small>
    </article>
  );
}
