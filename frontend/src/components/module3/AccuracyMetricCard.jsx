import React from 'react';

export default function AccuracyMetricCard({ consensusRate }) {
  const isHighAccuracy = consensusRate >= 80;
  const isMediumAccuracy = consensusRate >= 50;
  const tone = isHighAccuracy ? 'success' : isMediumAccuracy ? 'neutral' : 'danger';

  return (
    <article className={`matrixMetricCard ${tone}`}>
      <span>Consensus Accuracy Rate</span>
      <strong>{Number(consensusRate || 0).toFixed(1)}%</strong>
      <small style={{ fontSize: '9px', marginTop: '4px', opacity: 0.8 }}>
        {isHighAccuracy ? '🎯 Excellent Alignment' : isMediumAccuracy ? '⚖️ Moderate Alignment' : '⚠️ High Dissension'}
      </small>
    </article>
  );
}
