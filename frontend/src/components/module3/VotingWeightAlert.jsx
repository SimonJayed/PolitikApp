import React from 'react';

export default function VotingWeightAlert({ tier, weight }) {
  const displayWeight = weight !== undefined ? weight : tier.weight;
  return (
    <div className="status-toast alert-info" style={{
      background: 'rgba(59, 130, 246, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
      color: '#93c5fd',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px',
      borderLeft: '4px solid #3b82f6'
    }}>
      <strong>ℹ️ Active Auditor Tier:</strong> Your account is currently verified as a <strong>{tier.label}</strong>. Votes carry a <strong>x{displayWeight}</strong> weight multiplier.
    </div>
  );
}
