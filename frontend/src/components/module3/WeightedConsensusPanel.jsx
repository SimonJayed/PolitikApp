import React from 'react';

export default function WeightedConsensusPanel({ tier, consensusRate }) {
  return (
    <section className="matrixActionPanel" style={{
      marginTop: '20px',
      background: 'rgba(15, 23, 42, 0.4)',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px'
    }}>
      <div>
        <h4 style={{ margin: '0 0 8px', color: '#38bdf8', fontSize: '13px', letterSpacing: '0.05em' }}>
          📊 WEIGHTED CONSENSUS SIMULATOR
        </h4>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(241, 245, 249, 0.7)' }}>
          Mathematical impact of adjusted reviewer tier (currently **{tier.label}**) on community consensus parameters.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px', fontSize: '12px' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <strong>Consensus Weight Multiplier</strong>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e', margin: '4px 0' }}>x{tier.weight || 1}</div>
          <span style={{ fontSize: '11px', color: 'rgba(241, 245, 249, 0.5)' }}>Each vote is multiplied by role weight</span>
        </div>
        <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <strong>Consensus Power Percentage</strong>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', margin: '4px 0' }}>
            {((tier.weight || 1) * 20).toFixed(0)}%
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(241, 245, 249, 0.5)' }}>Consensus power compared to prime tier</span>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(241, 245, 249, 0.6)', marginBottom: '4px' }}>
          <span>Consensus Accuracy Meter</span>
          <strong>{Number(consensusRate || 0).toFixed(1)}% Accuracy</strong>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, consensusRate || 0))}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #ef4444 0%, #eab308 50%, #22c55e 100%)',
            transition: 'width 300ms ease'
          }} />
        </div>
      </div>
    </section>
  );
}
