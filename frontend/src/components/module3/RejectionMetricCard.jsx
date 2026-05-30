import React from 'react';

export default function RejectionMetricCard({ rate, isLocked }) {
  return (
    <article className={`matrixMetricCard ${isLocked ? 'danger' : 'neutral'}`}>
      <span>Lifetime Rejection Rate</span>
      <strong>{Number(rate || 0).toFixed(1)}%</strong>
      {isLocked && (
        <small style={{ color: 'var(--danger)', fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>
          ⚠️ LOCKOUT TRIGGERED (&gt;15%)
        </small>
      )}
    </article>
  );
}
