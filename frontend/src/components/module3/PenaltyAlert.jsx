import React from 'react';

export default function PenaltyAlert({ rate }) {
  if (rate <= 10) return null;

  return (
    <div className="status-toast alert-danger" style={{
      background: '#fee2e2',
      borderColor: '#fca5a5',
      color: '#991b1b',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px',
      borderLeft: '4px solid #ef4444'
    }}>
      <strong>⚠️ Penalty Warning:</strong> Your current submission rejection rate is {Number(rate || 0).toFixed(1)}%. If it exceeds 15.0%, your account will be restricted.
    </div>
  );
}
